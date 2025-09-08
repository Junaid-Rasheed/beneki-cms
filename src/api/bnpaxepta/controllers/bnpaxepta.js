'use strict';

const iconv = require('iconv-lite');
const crypto = require('crypto');
const fetch = require("node-fetch");

module.exports = {
  async createSession(ctx) {
    const { amount, currency, orderId, orderDesc = "Test:0000" } = ctx.request.body;

    const { Blowfish } = await import("egoroof-blowfish");

    const merchantId = process.env.BNP_MERCHANT_ID;
    const blowfishKey = process.env.BNP_BLOWFISH_KEY; // plain string from BNP
    const hmacKey    = process.env.BNP_HMAC_KEY;      // plain string from BNP

    // Amount in minor units
    const amountMinor = Math.round(Number(amount) * 100);

    // Request MAC per BNP: PayID*TransID*MerchantID*Amount*Currency (PayID empty here)
    const macSource = `*${orderId}*${merchantId}*${amountMinor}*${currency}`;
    const mac = crypto.createHmac("sha256", hmacKey)
      .update(macSource, "utf8")
      .digest("hex")
      .toUpperCase();

    const refNr = orderId.toString().padStart(12, "0");

    // Build the clear param string (order and casing matter)
    // URLs must be HTTPS, no query strings
    const clearParams = [
      `MerchantID=${merchantId}`,
      `MsgVer=2.0`,
      `TransID=${orderId}`,
      `RefNr=${refNr}`,
      `Amount=${amountMinor}`,
      `Currency=${currency}`,
      `URLNotify=${process.env.URL_NOTIFY}`,
      `URLSuccess=${process.env.URL_SUCCESS}`,
      `URLFailure=${process.env.URL_FAILURE}`,
      `Response=encrypt`,
      `OrderDesc=${orderDesc}`,
      `MAC=${mac}`,
      `Language=en`,
    ].join("&");

    // LEN = byte length of UNENCRYPTED string
    const len = Buffer.byteLength(clearParams, "utf8");

    // Encrypt -> hex uppercase
    const bf = new Blowfish(blowfishKey, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);
    const encrypted = bf.encode(clearParams, Blowfish.TYPE.UINT8_ARRAY);
    const dataHex = Buffer.from(encrypted).toString("hex").toUpperCase();

    ctx.send({
      MerchantID: merchantId,
      Len: len,
      Data: dataHex,
    });
  },

  async notify(ctx) {
    // With Response=encrypt you’ll get LEN & DATA here; decrypt & verify MAC
    const payload = ctx.request.body || ctx.query;
    strapi.log.info("BNP Notify payload", payload);
    ctx.send({ ok: true });
  },

};