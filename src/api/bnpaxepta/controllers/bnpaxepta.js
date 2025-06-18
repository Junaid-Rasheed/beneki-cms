const crypto = require('crypto');

function generateShaSign(params, shaInKey) {
  const sortedKeys = Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined && params[key] !== null)
    .sort();

  const signatureString = sortedKeys
    .map((key) => `${key.toUpperCase()}=${params[key]}${shaInKey}`)
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
      OPERATION: 'SAL',
    };

    const SHASIGN = generateShaSign(parameters, process.env.BNP_HMAC_KEY);

    // Return the BNP test/prod payment form URL (important!)
    const formUrl = process.env.BNP_HPP_URL;

    ctx.send({
      formUrl,
      params: {
        ...parameters,
        SHASIGN,
      },
    });
  }
};
