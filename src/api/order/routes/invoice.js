module.exports = {
  routes: [
    {
      method: "POST",
      path: "/invoices/send",
      handler: "invoice.sendInvoice",
      config: {
        auth: false, // set to true if only admins/users should trigger it
      },
    },
  ],
};
