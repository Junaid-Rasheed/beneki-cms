'use strict';

/**
 * delayed-gls-order routes — Admin list of fully handed non-France GLS orders past forecast.
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/delayed-gls-orders',
      handler: 'delayed-gls-order.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
