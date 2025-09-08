'use strict';

const iconv = require('iconv-lite');
const crypto = require('crypto');
const fetch = require("node-fetch");

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
    const { amount, currency, orderId, orderDesc = "Test:0000",browserInfo: biClient = {}, } = ctx.request.body;

    const { Blowfish } = await import("egoroof-blowfish");

    const merchantId = process.env.BNP_MERCHANT_ID;
    const blowfishKey = process.env.BNP_BLOWFISH_KEY; // plain string from BNP
    const hmacKey    = process.env.BNP_HMAC_KEY;      // plain string from BNP

    const acceptHeaders = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8";
    // try X-Forwarded-For chain, fall back to connection ip
    const xff = (ctx.request.headers["x-forwarded-for"] || "").split(",")[0].trim();
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
      timeZoneOffset: String(biClient.timeZoneOffset ?? new Date().getTimezoneOffset()),
      userAgent: String(biClient.userAgent || ctx.request.headers["user-agent"] || "").slice(0, 2048),
    };

    // Validate minimal requirements from the schema:
    // When javaScriptEnabled = true, required fields are:
    // acceptHeaders, javaEnabled, javaScriptEnabled, colorDepth, screenHeight, screenWidth,
    // timeZoneOffset, language, userAgent. (ipAddress is not required in this branch)
    const requiredKeys = [
      "acceptHeaders","javaEnabled","javaScriptEnabled","colorDepth",
      "screenHeight","screenWidth","timeZoneOffset","language","userAgent"
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
    const mac = crypto.createHmac("sha256", hmacKey)
      .update(macSource, "utf8")
      .digest("hex")
      .toUpperCase();

    const refNr = orderId.toString().padStart(12, "0");
    const browserInfoJson = JSON.stringify(normalized);
     strapi.log.info("BrowserInfor"+ browserInfoJson);
    // Build the clear param string (order and casing matter)
    // URLs must be HTTPS, no query strings
    const clearParams = [
      `MerchantID=${merchantId}`,
      `TransID=${orderId}`,
      `MsgVer=2.0`,
      `RefNr=${refNr}`,
      `Amount=${amountMinor}`,
      `Currency=${currency}`,
      `OrderDesc=${orderDesc}`,
      `browserInfo=${browserInfoJson}`,
      `URLSuccess=${process.env.URL_SUCCESS}`,
      `URLFailure=${process.env.URL_FAILURE}`,    
      `URLNotify=${process.env.URL_NOTIFY}`,
      `MAC=${mac}`
    ].join("&");

     strapi.log.info("Data"+ JSON.stringify(clearParams));
    // LEN = byte length of UNENCRYPTED string
    const len = Buffer.byteLength(clearParams, "utf8");

    // Encrypt -> hex uppercase
    const bf = new Blowfish(blowfishKey, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);
    const encrypted = bf.encode(clearParams, Blowfish.TYPE.UINT8_ARRAY);
    const dataHex = Buffer.from(encrypted).toString("hex").toUpperCase();

    ctx.send({
      MerchantID: merchantId,
      Len: len,
      Data: dataHex
    });
  },

  async notify(ctx) {
    // With Response=encrypt you’ll get LEN & DATA here; decrypt & verify MAC
    const payload = ctx.request.body || ctx.query;
    strapi.log.info("BNP Notify payload" + JSON.stringify(payload));
    ctx.send({ ok: true });
  },

};