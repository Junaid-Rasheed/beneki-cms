'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/logistic:notify',
      handler: 'logistic.notify',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
