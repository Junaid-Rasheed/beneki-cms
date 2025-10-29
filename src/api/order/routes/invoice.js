module.exports = {
  routes: [
    {
      method: "POST",
      path: "/invoices/send",
      handler: "invoice.sendInvoiceEmailHandler",
      config: {
        auth: false,
      },
    },
  ],
};
