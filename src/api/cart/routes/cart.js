module.exports = {
  routes: [
    {
      method: "GET",
      path: "/cart/me",
      handler: "cart.me",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PUT",
      path: "/cart/me",
      handler: "cart.updateMe",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
