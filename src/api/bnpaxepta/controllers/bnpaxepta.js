'use strict';

const iconv = require('iconv-lite');
const crypto = require('crypto');

// If you're in CommonJS Strapi, dynamic import for egoroof-blowfish (ESM)
async function getBlowfish() {
  const mod = await import('egoroof-blowfish');
  return mod.Blowfish;
}

function toUpperHex(buffer) {
  return Buffer.from(buffer).toString('hex').toUpperCase();
}

/**
 * Helper: create HMAC SHA256 hex uppercase (if you need to send MAC).
 * Axepta uses MAC param in some flows. Keep function for validation.
 */
function createHmacSha256HexUpper(message, key) {
  const h = crypto.createHmac('sha256', key);
  h.update(message);
  return h.digest('hex').toUpperCase();
}

module.exports = {
  // POST /api/bnpaxepta/create-payment
  async createPayment(ctx) {
    try {
      const { amount, currency, orderId } = ctx.request.body;

      if (!amount || !currency || !orderId) {
        return ctx.throw(400, 'Missing required fields');
      }

      const Blowfish = await getBlowfish();

      // Build the plain payload (NVP string). Len must represent length of this plain string.
      const payloadObj = {
        AMOUNT: amount,
        CURRENCY: currency,
        ORDERID: orderId,
        URLBack: process.env.BNP_URLBACK,      // notification/callback
        URLSuccess: process.env.BNP_URLSUCCESS,
        URLFailure: process.env.BNP_URLFAILURE,
        PayType: process.env.BNP_PAYTYPE || 'CreditCard',
        Template: process.env.BNP_TEMPLATE,
        Language: process.env.BNP_LANGUAGE || 'EN'
      };

      const payloadString = Object.entries(payloadObj)
        .filter(([k,v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');

      // encode latin1 as Axepta expects single-byte encoding
      const payloadBytes = iconv.encode(payloadString, 'latin1');

      // Blowfish ECB PKCS5
      const bf = new Blowfish(process.env.BNP_BLOWFISH_KEY, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);

      // encrypt raw bytes, 'encode' returns Buffer/Uint8Array depending lib version
      const encrypted = bf.encode(payloadBytes);
      const dataHex = toUpperHex(Buffer.from(encrypted));

      // Len MUST be length of unencrypted payload string:
      const len = payloadBytes.length;

      // Optionally, create MAC (HMAC-SHA256 uppercase hex) if your contract expects MAC param
      // Compose the MAC base string exactly as your docs/merchant config require. Example shows simple combine:
      //const mac = createHmacSha256HexUpper(`${process.env.BNP_MERCHANT_ID}${payloadString}`, process.env.BNP_HMAC_KEY);

      // Build final redirect URL for payssl.aspx
      const redirectUrl = `${process.env.BNP_PAYMENT_URL}?MerchantID=${encodeURIComponent(process.env.BNP_MERCHANT_ID)}&Len=${len}&Data=${encodeURIComponent(dataHex)}&Template=${encodeURIComponent(process.env.BNP_TEMPLATE)}&Language=${encodeURIComponent(process.env.BNP_LANGUAGE)}`;

      // Return redirect URL to frontend
      ctx.send({ redirectUrl });

    } catch (err) {
      console.error('BNP createPayment error:', err);
      ctx.throw(500, 'Payment creation failed');
    }
  },

  // POST /api/bnpaxepta/payment-callback
  // Axepta posts back Data & Len (and maybe other params).
  // This endpoint must decrypt quickly, process the transaction and respond with HTTP 200 body "OK"
  async paymentCallback(ctx) {
    try {
      // Axepta may send POST form or GET in some fallbacks. Handle both.
      const incoming = ctx.request.method === 'GET' ? ctx.request.query : ctx.request.body;

      const Data = incoming.Data || incoming.data;
      const Len = incoming.Len || incoming.len;

      if (!Data || !Len) {
        console.warn('BNP callback missing Data/Len', incoming);
        ctx.status = 400;
        return ctx.body = 'Missing Data/Len';
      }

      const Blowfish = await getBlowfish();
      const bf = new Blowfish(process.env.BNP_BLOWFISH_KEY, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);

      const encryptedBuffer = Buffer.from(Data, 'hex');
      const decryptedBuffer = bf.decode(encryptedBuffer);
      // Trim to the expected Len (Len is length of unencrypted payload in bytes)
      const actualLen = parseInt(Len, 10);
      const trimmed = Buffer.from(decryptedBuffer).slice(0, actualLen);

      const decryptedString = iconv.decode(trimmed, 'latin1');
      console.log('BNP Decrypted callback payload:', decryptedString);

      // Parse into object
      const params = {};
      decryptedString.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        params[k] = v;
      });

      // Example params you may get: STATUS, TRANSACTIONID, AMOUNT, CURRENCY, ORDERID, REFNR, Response, etc.
      // Validate HMAC/MAC if your merchant config requires it. If Axepta sends a MAC in plain or via DataSmall you should verify it here.
      // If you keep a record of the Order by ORDERID, update your DB here:
      // await strapi.db.query('api::order.order').update({ where: { orderId: params.ORDERID }, data: { status: 'paid', transactionId: params.TRANSACTIONID } });

      // IMPORTANT: Respond quickly with HTTP 200 and content Axepta expects (usually plain 'OK' or HTTP 200)
      // Docs: payment platform will consider "timeout" if callback not received or delayed. Send plain 200 ASAP.
      ctx.status = 200;
      ctx.body = 'OK';

      // Process order updates (you can do asynchronous work afterwards, but try to finish DB update quickly).
      // NOTE: If you need more time for heavy processing, you can quickly ack with OK and then run background jobs.
    } catch (error) {
      console.error('BNP callback error:', error);
      ctx.status = 500;
      ctx.body = 'FAIL';
    }
  }
};