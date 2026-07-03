"use strict";

const iconv = require("iconv-lite");
const crypto = require("crypto");
const fetch = require("node-fetch");
const {
  getLocaleFromOrder,
  getEmailTemplate,
  sendFailedPaymentEmail,
} = require("../../../utils/emailHelpers");
const {
  generateMultiLabelByOrderId,
} = require("../../../helpers/labelGenerator");
const UiUrl = process.env.FRONTEND_URL;
const SUCCESS_STATUSES = ["OK", "SUCCESS", "AUTHORIZED", "APPROVED"];
const FAILED_STATUSES = ["FAILED", "DECLINED", "ERROR", "CANCELLED", "TIMEOUT"];
function clampColorDepth(depth) {
  // BNP allows: 1,4,8,15,16,24,32,48; if 30/36, step down to nearest lower allowed
  const allowed = [1, 4, 8, 15, 16, 24, 32, 48];
  if (allowed.includes(depth)) return depth;
  if (depth === 36) return 32;
  if (depth === 30) return 24;
  // fall back to 24 if something weird shows up
  return 24;
}

module.exports = {
  async createSession(ctx) {
    const {
      amount,
      currency,
      orderId,
      browserInfo: biClient = {},
    } = ctx.request.body;

    const { Blowfish } = await import("egoroof-blowfish");

    const merchantId = process.env.BNP_MERCHANT_ID;
    const blowfishKey = process.env.BNP_BLOWFISH_KEY; // plain string from BNP
    const hmacKey = process.env.BNP_HMAC_KEY; // plain string from BNP

    const acceptHeaders =
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8";
    // try X-Forwarded-For chain, fall back to connection ip
    const xff = (ctx.request.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim();
    const ipAddress = xff || ctx.request.ip || "";

    // From client (JS-only fields) with normalization:
    const jsEnabled = true; // this endpoint is called from JS
    const normalized = {
      acceptHeaders,
      ipAddress,
      javaEnabled: Boolean(biClient.javaEnabled),
      javaScriptEnabled: jsEnabled,
      language: String(biClient.language || "en-US").slice(0, 8),
      colorDepth: clampColorDepth(Number(biClient.colorDepth ?? 24)),
      screenHeight: Number(biClient.screenHeight ?? 0),
      screenWidth: Number(biClient.screenWidth ?? 0),
      timeZoneOffset: String(
        biClient.timeZoneOffset ?? new Date().getTimezoneOffset(),
      ),
      userAgent: String(
        biClient.userAgent || ctx.request.headers["user-agent"] || "",
      ).slice(0, 2048),
    };

    // Validate minimal requirements from the schema:
    // When javaScriptEnabled = true, required fields are:
    // acceptHeaders, javaEnabled, javaScriptEnabled, colorDepth, screenHeight, screenWidth,
    // timeZoneOffset, language, userAgent. (ipAddress is not required in this branch)
    const requiredKeys = [
      "acceptHeaders",
      "javaEnabled",
      "javaScriptEnabled",
      "colorDepth",
      "screenHeight",
      "screenWidth",
      "timeZoneOffset",
      "language",
      "userAgent",
    ];
    for (const k of requiredKeys) {
      if (
        normalized[k] === undefined ||
        normalized[k] === null ||
        (typeof normalized[k] === "string" && normalized[k].length === 0)
      ) {
        ctx.throw(400, `browserInfo.${k} is required`);
      }
    }

    // Amount in minor units
    const amountMinor = Math.round(Number(amount) * 100);

    // Request MAC per BNP: PayID*TransID*MerchantID*Amount*Currency (PayID empty here)
    const macSource = `*${orderId}*${merchantId}*${amountMinor}*${currency}`;
    const mac = crypto
      .createHmac("sha256", hmacKey)
      .update(macSource, "utf8")
      .digest("hex")
      .toUpperCase();

    // Pad to 12 digits
    let refNr = orderId.replace(/\D/g, "");
    if (!refNr) refNr = String(Date.now()); // fallback
    refNr = refNr.substring(0, 12);
    // Build parameter string with proper encoding
    const browserInfoBase64 = Buffer.from(JSON.stringify(normalized)).toString(
      "base64",
    );

    const clearParams = [
      `MerchantID=${merchantId}`,
      `TransID=${orderId}`,
      `MsgVer=2.0`,
      `RefNr=${refNr}`,
      `Amount=${amountMinor}`,
      `Currency=${currency}`,
      `browserInfo=${browserInfoBase64}`,
      `URLSuccess=${process.env.URL_SUCCESS}`,
      `URLFailure=${process.env.URL_FAILURE}`,
      `URLNotify=${process.env.URL_NOTIFY}`,
      `MAC=${mac}`,
    ].join("&");

    strapi.log.info("Data" + clearParams);
    // LEN = byte length of UNENCRYPTED string
    const len = Buffer.byteLength(clearParams, "utf8");

    // Encrypt -> hex uppercase
    const bf = new Blowfish(
      blowfishKey,
      Blowfish.MODE.ECB,
      Blowfish.PADDING.PKCS5,
    );
    const encrypted = bf.encode(clearParams, Blowfish.TYPE.UINT8_ARRAY);
    const dataHex = Buffer.from(encrypted).toString("hex").toUpperCase();

    ctx.send({
      MerchantID: merchantId,
      Len: len,
      Data: dataHex,
    });
  },

  async notify(ctx) {
    try {
      const { Blowfish } = await import("egoroof-blowfish");

      const payload = ctx.request.body || ctx.query;

      if (!payload?.Data) {
        return ctx.badRequest("Missing Data");
      }

      const bf = new Blowfish(
        process.env.BNP_BLOWFISH_KEY,
        Blowfish.MODE.ECB,
        Blowfish.PADDING.PKCS5,
      );

      const encryptedBytes = Buffer.from(payload.Data, "hex");
      const decryptedBytes = bf.decode(
        encryptedBytes,
        Blowfish.TYPE.UINT8_ARRAY,
      );

      const decrypted = Buffer.from(decryptedBytes)
        .toString("latin1")
        .replace(/\0/g, "")
        .trim();

      const parsed = {};
      decrypted.split("&").forEach((part) => {
        const i = part.indexOf("=");
        if (i === -1) return;
        parsed[part.substring(0, i)] = part.substring(i + 1);
      });

      const orderId = parsed.TransID;
      const transactionId = parsed.PayID;
      const status = parsed.Status;

      if (!orderId) {
        return ctx.badRequest("Missing orderId");
      }

      const order = await strapi.db.query("api::order.order").findOne({
        where: { orderNumber: orderId },
        populate: ["billingAddress", "shippingAddress", "orderItems"],
      });

      if (!order) {
        return ctx.badRequest("Order not found");
      }

      const updateData = {
        transactionId,
      };

      // =========================
      // 🚨 CORE RULE (IMPORTANT)
      // =========================

      strapi.log.info(`✅ Status for ${orderId}: ${status}`);
      if (order.paymentStatus === "paid") {
        strapi.log.info(`⛔ Ignoring FAILED for paid order ${orderId}`);
        return ctx.send("OK");
      }

      if (FAILED_STATUSES.includes(status)) {
        // ❌ DO NOT overwrite paid orders
        if (order.paymentStatus === "paid") {
          strapi.log.info(`⛔ Ignoring FAILED for paid order ${orderId}`);
          return ctx.send("OK");
        }

        updateData.paymentStatus = "failed";
        updateData.orderStatus = "pending";

        const isTimeout = parsed.Description?.toLowerCase().includes("timeout");

        if (isTimeout) {
          const locale = getLocaleFromOrder(order);
          const template = await getEmailTemplate(strapi, locale);

          const email =
            order.deliveryAddress?.email || order.billingAddress?.email;

          await sendFailedPaymentEmail(strapi, email, template, order);
        }
      } else if (SUCCESS_STATUSES.includes(status)) {
        const latestOrders = await strapi.db
          .query("api::order.order")
          .findMany({
            select: ["invoiceId"],
            where: {
              invoiceId: { $notNull: true }, // 🔥 ignore nulls
            },
            orderBy: { invoiceId: "desc" },
            limit: 1,
          });

        let nextInvoiceId = 1;

        if (latestOrders.length > 0) {
          nextInvoiceId = Number(latestOrders[0].invoiceId) + 1;
        }
        console.log("invoiceId:", nextInvoiceId);
        console.log("Latestorder:", latestOrders);

        updateData.paymentStatus = "paid";
        updateData.orderStatus = "processing";
        (updateData.transactionId = transactionId),
          (updateData.invoiceId = nextInvoiceId);
      }

      await strapi.db.query("api::order.order").update({
        where: { orderNumber: orderId },
        data: updateData,
      });
      strapi.log.info(`✅ Notify processed for ${orderId}`);
      if (
        SUCCESS_STATUSES.includes(status) &&
        order.shippingAddress?.country?.toLowerCase() === "france"
      ) {
        await generateMultiLabelByOrderId(order);

        strapi.log.info(`✅ Label generated for ${orderId}`);
      }

      return ctx.send("OK");
    } catch (error) {
      strapi.log.error("❌ Notify error: " + error.message);
      return ctx.internalServerError("Notify failed");
    }
  },

  async success(ctx) {
    try {
      const data = ctx.request.body;

      const orderId = data.TransID;

      return ctx.redirect(`${UiUrl}payment-success?orderId=${orderId}`);
    } catch (error) {
      return ctx.redirect(`${UiUrl}payment-failed`);
    }
  },

  async failure(ctx) {
    try {
      const data = ctx.method === "POST" ? ctx.request.body : ctx.query;

      const orderId = data.TransID;

      return ctx.redirect(`${UiUrl}payment-failed?orderId=${orderId}`);
    } catch (error) {
      return ctx.redirect(`${UiUrl}payment-failed`);
    }
  },
};
