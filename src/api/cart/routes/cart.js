module.exports = {
  routes: [
    {
      method: "GET",
      path: "/me",
      handler: "cart.me",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PUT",
      path: "/me",
      handler: "cart.updateMe",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
