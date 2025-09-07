// src/api/bnpaxepta/routes/bnpaxepta.js
module.exports = {
  routes: [
    // {
    //   method: 'POST',
    //   path: '/bnpaxepta/processpayment',
    //   handler: 'bnpaxepta.processpayment',
    //   config: {
    //     auth: false,
    //     type: 'content-api', // 🔧 Required by users-permissions
    //   },
    // },
    // {
    //   method: 'POST',
    //   path: '/bnpaxepta/create-payment',
    //   handler: 'bnpaxepta.createPayment',
    //   config: { auth: false }
    // },
    // {
    //   method: 'POST',
    //   path: '/bnpaxepta/payment-callback',
    //   handler: 'bnpaxepta.paymentCallback',
    //   config: { auth: false }
    // },
    // // some 3DS flows may call via GET
    // {
    //   method: 'GET',
    //   path: '/bnpaxepta/payment-callback',
    //   handler: 'bnpaxepta.paymentCallback',
    //   config: { auth: false }
    // },
    // {
    //   method: "POST",
    //   path: "/bnpaxepta/create",
    //   handler: "bnpaxepta.create",
    //   config: { auth: false }, // make it public
    // },
    {
      method: "POST",
      path: "/bnpaxepta/create-session",
      handler: "bnpaxepta.createSession",
      config: { auth: false }, // BNP must access this
    },
    {
      method: "POST",
      path: "/bnpaxepta/notify",
      handler: "bnpaxepta.notify",
      config: { auth: false },
    },
  ],
};
