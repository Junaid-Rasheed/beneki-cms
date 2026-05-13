module.exports = {
  routes: [
    {
      method: "POST",
      path: "/dpd/generate-multi-label",
      handler: "dpd.generateMultiLabel",
      config: {
        auth: false,
      },
    },
  ],
};