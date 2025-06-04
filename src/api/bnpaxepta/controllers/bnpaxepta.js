const crypto = require('crypto');

function generateShaSign(params, shaInKey) {
  const sortedKeys = Object.keys(params).sort();
  const signatureString = sortedKeys
    .map((key) => `${key}=${params[key]}${shaInKey}`)
    .join('');
  return crypto.createHash('sha256').update(signatureString).digest('hex').toUpperCase();
}
module.exports = {
  async createHppSession(ctx) {
    const { orderId, amount } = ctx.request.body;

    const parameters = {
      PSPID: process.env.BNP_PSPID,
      ORDERID: orderId,
      AMOUNT: Math.round(amount * 100), // Convert to cents
      CURRENCY: 'EUR',
      LANGUAGE: 'en_US',
      ACCEPTURL: process.env.BNP_ACCEPT_URL,
      DECLINEURL: process.env.BNP_DECLINE_URL,
      CANCELURL: process.env.BNP_CANCEL_URL,
      EXCEPTIONURL: process.env.BNP_EXCEPTION_URL,
      OPERATION: 'SAL', // or 'RES' for authorization only
    };

    const SHASIGN = generateShaSign(parameters, process.env.BNP_HMAC_KEY);
    ctx.send({ ...parameters, SHASIGN });
  }
};

