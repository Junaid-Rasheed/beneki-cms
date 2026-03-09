module.exports = {
  routes: [
    {
      method: "POST",
      path: "/email-localized/forgot-password",
      handler: "email-localized.forgotPassword",
      config: {
        auth: false,
      },
    },
  ],
};