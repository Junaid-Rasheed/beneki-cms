
'use strict';
const axios = require('axios');
const CryptoJS = require('crypto-js');

const MID = 'BNP_BENEKI_ECOM_t';
const BLOWFISH_KEY = process.env.BNP_BLOWFISH_KEY;
const HMAC_KEY = process.env.BNP_HMAC_KEY;

function blowfishEncrypt(data, key) {
  return CryptoJS.Blowfish.encrypt(
    data,
    CryptoJS.enc.Utf8.parse(key),
    { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
  ).toString();
}

function generateHmac(data, hmacKey) {
  return CryptoJS.HmacSHA256(data, hmacKey).toString(CryptoJS.enc.Hex);
}

module.exports = {
  async processpayment(ctx) {
    try {
      console.log('🔔 Payment request received at /api/bnpaxepta/processpayment');
      console.log('🔍 Raw body:', ctx.request.body);

      const { cardNumber, expMonth, expYear, cvv, amount } = ctx.request.body;

      if (!cardNumber || !expMonth || !expYear || !cvv || !amount) {
        console.error('❌ Missing required fields');
        return ctx.badRequest('Missing required payment fields');
      }

      // Step 1: Encrypt sensitive data
      const encryptedCard = blowfishEncrypt(cardNumber, BLOWFISH_KEY);
      const encryptedExp = blowfishEncrypt(`${expMonth}${expYear}`, BLOWFISH_KEY); // Fixed template literal
      const encryptedCvv = blowfishEncrypt(cvv, BLOWFISH_KEY);

      console.log('🔐 Encrypted Card:', encryptedCard);
      console.log('🔐 Encrypted Expiry:', encryptedExp);
      console.log('🔐 Encrypted CVV:', encryptedCvv);

      // Step 2: Create payload
      const payload = {
        merchantId: MID,
        amount: amount,
        currency: 'EUR',
        card: encryptedCard,
        expiry: encryptedExp,
        cvv: encryptedCvv,
        transactionType: 'sale',
        reference: `order-${Date.now()}` // Fixed template literal
      };

      console.log('📦 Payload before HMAC:', payload);

      // Step 3: Create HMAC signature
      const payloadString = Object.values(payload).join('');
      const signature = generateHmac(payloadString, HMAC_KEY);
      payload.hmac = signature;

      console.log('🔏 HMAC Signature:', signature);
      console.log('📦 Final Payload:', payload);

      // Step 4: Send to BNP
      const response = await axios.post(
        'https://paymentpage.axepta.bnpparibas/payinterim.aspx',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ BNP Response:', response.data);

      return ctx.send({
        status: response.data.status,
        bnpResponse: response.data,
      });
    } catch (err) {
  console.error('🔥 BNP Payment Error:', err.message);
  console.error('🧵 Stack:', err.stack);

  if (err.response) {
    console.error('🚨 BNP Error Response:', err.response.data);
    return ctx.send({
      status: 'error',
      message: err.response.data, // Show actual BNP error
    });
  }

  return ctx.send({
    status: 'error',
    message: err.message,
    stack: err.stack
  });
  }
  },
};