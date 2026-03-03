// src/api/bnpaxepta/routes/bnpaxepta.js
module.exports = {
  routes: [
   
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
     {
      method: "POST",
      path: "/bnpaxepta/payment-success",
      handler: "bnpaxepta.success",
      config: {
        auth: false,
      },
    },
     {
      method: "GET",
      path: "/bnpaxepta/payment-failure",
      handler: "bnpaxepta.failure",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/bnpaxepta/payment-failure",
      handler: "bnpaxepta.failure",
      config: {
        auth: false,
      },
    },
  ],
};
