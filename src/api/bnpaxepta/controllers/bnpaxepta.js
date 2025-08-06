'use strict';
const CryptoJS = require('crypto-js');
const qs = require('querystring');

const BLOWFISH_KEY = process.env.BNP_BLOWFISH_KEY;
const HMAC_KEY = process.env.BNP_HMAC_KEY;
const MERCHANT_ID = process.env.BNP_MERCHANT_ID;
const RETURN_URL = process.env.BNP_RETURN_URL;
const CANCEL_URL = process.env.BNP_CANCEL_URL;
const UiUrl = process.env.FRONTEND_URL;

function blowfishEncrypt(data, key) {
  const encrypted = CryptoJS.Blowfish.encrypt(data, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}

function hmacSha256(data, key) {
  return CryptoJS.HmacSHA256(data, key).toString(CryptoJS.enc.Hex);
}

module.exports = {
  async processpayment(ctx) {
    const { amount, orderId, customerEmail } = ctx.request.body;

    if (!amount || !orderId) {
      return ctx.badRequest('Missing required parameters');
    }

    const params = {
      Amount: amount,
      OrderID: orderId,
      Email: customerEmail,
      URLBack: 'http://localhost:5173/payment-success',
      Language: 'fr',
      Template: 'Cards_BNP_v1',
      PayType: 1,
    };

    const formData = Object.entries(params)
      .map(([key, val]) => `${key}=${val}`)
      .join('&');

    const encryptedData = blowfishEncrypt(formData, BLOWFISH_KEY);

    const redirectUrl = `https://paymentpage.axepta.bnpparibas/payssl.aspx?MerchantID=BNP_BENEKI_ECOM&Data=${encodeURIComponent(
      encryptedData
    )}&Len=${formData.length}&Template=${params.Template}&Language=${params.Language}&URLBack=${encodeURIComponent(params.URLBack)}&PayType=${params.PayType}`;

    return ctx.send({ redirectUrl });
  },
};