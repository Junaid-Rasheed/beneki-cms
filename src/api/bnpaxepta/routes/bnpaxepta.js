// src/api/payment/routes/payment.js
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/bnpaxepta/hpp-session',
      handler: 'bnpaxepta.createHppSession',
      config: {
        auth: false,
        type: 'content-api', // 🔧 Required by users-permissions
      },
    },
  ],
};
