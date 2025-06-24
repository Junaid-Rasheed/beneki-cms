// src/api/bnpaxepta/routes/bnpaxepta.js
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/bnpaxepta/processpayment',
      handler: 'bnpaxepta.processpayment',
      config: {
        auth: false,
        type: 'content-api', // 🔧 Required by users-permissions
      },
    },
  ],
};
