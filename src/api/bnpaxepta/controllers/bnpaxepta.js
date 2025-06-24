'use strict';
const axios = require('axios');
const CryptoJS = require('crypto-js');
const qs = require('querystring'); // ✅ Required for x-www-form-urlencoded

const MID = 'BNP_BENEKI_ECOM_t';
const BLOWFISH_KEY = process.env.BNP_BLOWFISH_KEY;
const HMAC_KEY = process.env.BNP_HMAC_KEY;

// ✅ Change to hex encoding
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

module.exports = {
  async processpayment(ctx) {
    try {
      const { cardNumber, expMonth, expYear, cvv, amount } = ctx.request.body;

      if (!cardNumber || !expMonth || !expYear || !cvv || !amount) {
        return ctx.badRequest('Missing required payment fields');
      }

      // 🔐 Encrypt data (in hex format)
      const encryptedCard = blowfishEncrypt(cardNumber, BLOWFISH_KEY);
      const encryptedExp = blowfishEncrypt(`${expMonth}${expYear}`, BLOWFISH_KEY);
      const encryptedCvv = blowfishEncrypt(cvv, BLOWFISH_KEY);

      // 📦 Prepare payload
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

      // 🔏 Generate HMAC
      const payloadString = Object.values(payload).join('');
      const signature = generateHmac(payloadString, HMAC_KEY);
      payload.hmac = signature;

      // 🚀 Send to BNP (x-www-form-urlencoded)
      const response = await axios.post(
        'https://paymentpage.axepta.bnpparibas/direct.aspx',
        qs.stringify(payload),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return ctx.send({
        status: 'success',
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
