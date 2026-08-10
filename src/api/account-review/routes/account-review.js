'use strict';

/**
 * account-review routes — Admin B2B application review (storefront Admin UI).
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/account-reviews',
      handler: 'account-review.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/account-reviews/:id',
      handler: 'account-review.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/account-reviews/:id/action',
      handler: 'account-review.performAction',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
