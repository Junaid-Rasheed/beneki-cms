'use strict';
const axios = require('axios');
const CryptoJS = require('crypto-js');
const qs = require('querystring');

const MID = 'BNP_BENEKI_ECOM_t';
const BLOWFISH_KEY = process.env.BNP_BLOWFISH_KEY;
const HMAC_KEY = process.env.BNP_HMAC_KEY;

function blowfishEncrypt(data, key) {
  const encrypted = CryptoJS.Blowfish.encrypt(
    data,
    CryptoJS.enc.Utf8.parse(key),
    { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
  );
  return encrypted.ciphertext.toString(CryptoJS.enc.Hex);
}

function generateHmac(data, hmacKey) {
  return CryptoJS.HmacSHA256(data, hmacKey).toString(CryptoJS.enc.Hex);
}

function parseBnpResponse(responseText) {
  const result = {};
  const pairs = responseText.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    result[key] = value;
  }
  return result;
}

module.exports = {
  async processpayment(ctx) {
    try {
      const { cardNumber, expMonth, expYear, cvv, amount } = ctx.request.body;

      if (!cardNumber || !expMonth || !expYear || !cvv || !amount) {
        return ctx.badRequest('Missing required payment fields');
      }

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

      const payloadString = Object.values(payload).join('');
      const signature = generateHmac(payloadString, HMAC_KEY);
      payload.hmac = signature;

      const response = await axios.post(
        'https://paymentpage.axepta.bnpparibas/direct.aspx',
        qs.stringify(payload),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const parsedResponse = parseBnpResponse(response.data);
      const bnpStatus = parsedResponse.Status || 'UNKNOWN';

      return ctx.send({
        status: bnpStatus, // ✅ this reflects the real payment status
        bnpResponse: response.data,
        debug: {
          encryptedCard,
          encryptedExp,
          encryptedCvv,
          hmac: signature,
          payload
        }
      });

    } catch (err) {
      if (err.response) {
        return ctx.send({
          status: 'error',
          message: err.response.data,
        });
      }

      return ctx.send({
        status: 'error',
        message: err.message,
        stack: err.stack,
      });
    }
  },
};
