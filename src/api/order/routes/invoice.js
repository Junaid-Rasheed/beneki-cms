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
    {
      method: "GET",
      path: "/invoices/getTotalSales",
      handler: "invoice.getTotalsByDate",
      config: {
        auth: false,
      },
    },
  ],
};
