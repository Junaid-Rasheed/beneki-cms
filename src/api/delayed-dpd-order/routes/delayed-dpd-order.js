'use strict';

/**
 * delayed-dpd-order routes — Admin list of fully handed France DPD orders past forecast.
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/delayed-dpd-orders',
      handler: 'delayed-dpd-order.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
