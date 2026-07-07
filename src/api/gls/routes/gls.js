module.exports = {
  routes: [
    {
      method: "POST",
      path: "/gls/generate-multi-label",
      handler: "gls.generateMultiLabel",
      config: {
        auth: false,
      },
    },
  ],
};