module.exports = {
  routes: [
    {
      method: "POST",
      path: "/paypal/create-order",
      handler: "paypal.createOrder",
    },
    {
      method: "GET",
      path: "/paypal/capture-order",
      handler: "paypal.captureOrder",
    },
  ],
};