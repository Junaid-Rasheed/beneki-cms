'use strict';
const axios = require('axios');
const CryptoJS = require('crypto-js');

const MID = process.env.BNP_MID;
const BLOWFISH_KEY = process.env.BNP_BLOWFISH_KEY;
const HMAC_KEY = process.env.BNP_HMAC_KEY;

function blowfishEncrypt(data, key) {
  return CryptoJS.TripleDES.encrypt(data, CryptoJS.enc.Utf8.parse(key), {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  }).toString();
}

function generateHmac(data, hmacKey) {
  return CryptoJS.HmacSHA256(data, hmacKey).toString(CryptoJS.enc.Hex);
}

module.exports = {
  async processpayment(ctx) {
    try {
      const { cardNumber, expMonth, expYear, cvv, amount } = ctx.request.body;

      const encryptedCard = blowfishEncrypt(cardNumber, BLOWFISH_KEY);
      const encryptedExp = blowfishEncrypt(`${expMonth}${expYear}`, BLOWFISH_KEY);
      const encryptedCvv = blowfishEncrypt(cvv, BLOWFISH_KEY);

      const payload = {
        merchantId: MID,
        amount: amount,
        currency: 'EUR',
        card: encryptedCard,
        expiry: encryptedExp,
        cvv: encryptedCvv,
        transactionType: 'sale',
        reference: `order-${Date.now()}`
      };

      // HMAC Signature (may depend on BNP’s spec — adjust if needed)
      const payloadString = Object.values(payload).join('');
      const signature = generateHmac(payloadString, HMAC_KEY);
      payload.hmac = signature;

      const response = await axios.post('https://test.axepta.bnpparibas.com/api/payment', payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return ctx.send({ status: response.data.status, bnpResponse: response.data });
    } catch (err) {
      console.error('BNP Payment Error:', err.message);
      ctx.throw(500, 'Payment processing failed');
    }
  }
};