'use strict';

/**
 * missing-dpd-order routes — Admin list of France DPD orders with incomplete box handovers.
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/missing-dpd-orders',
      handler: 'missing-dpd-order.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
