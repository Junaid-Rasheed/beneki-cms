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
  ],
};
