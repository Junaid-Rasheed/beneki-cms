module.exports = {
  routes: [
    {
      method: "POST",
      path: "/orders/send-invoice",
      handler: "order.sendInvoice",
      config: {
        auth: true, // change to true if you want to require login
      },
    },
  ],
};
