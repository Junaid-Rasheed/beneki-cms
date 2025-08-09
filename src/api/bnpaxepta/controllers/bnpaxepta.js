const iconv = require('iconv-lite');

module.exports = {
  async createPayment(ctx) {
    try {
      const { amount, currency, orderId } = ctx.request.body;

      // dynamically import the ESM module
      const { Blowfish } = await import('egoroof-blowfish');

      const payloadObj = {
        AMOUNT: amount,
        CURRENCY: currency,
        ORDERID: orderId,
        URLBACK: process.env.BNP_URLBACK,
        PAYTYPE: process.env.BNP_PAYTYPE
      };

      const payloadString = Object.entries(payloadObj)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');

      const payloadBytes = iconv.encode(payloadString, 'latin1');

      const bf = new Blowfish(process.env.BNP_BLOWFISH_KEY, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);
      const encrypted = bf.encode(payloadBytes);

      const dataHex = Buffer.from(encrypted).toString('hex').toUpperCase();
      const len = dataHex.length;

      const redirectUrl = `${process.env.BNP_PAYMENT_URL}?MerchantID=${process.env.BNP_MERCHANT_ID}&Data=${dataHex}&Len=${len}&Template=${process.env.BNP_TEMPLATE}&Language=${process.env.BNP_LANGUAGE}&URLBack=${encodeURIComponent(process.env.BNP_URLBACK)}&PayType=${process.env.BNP_PAYTYPE}`;

      ctx.send({ redirectUrl });
    } catch (err) {
      console.error('BNP Payment Error:', err);
      ctx.throw(500, 'Payment processing failed');
    }
  }
};