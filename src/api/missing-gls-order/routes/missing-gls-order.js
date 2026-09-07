'use strict';

/**
 * missing-gls-order routes — Admin list of non-France GLS orders with incomplete box handovers.
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/missing-gls-orders',
      handler: 'missing-gls-order.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
