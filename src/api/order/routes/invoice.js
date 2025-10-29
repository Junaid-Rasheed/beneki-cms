module.exports = {
  routes: [
    {
      method: "POST",
      path: "/invoices/send",
      handler: "invoice.sendInvoice",
      config: {
        auth: false,
      },
    },
  ],
};
