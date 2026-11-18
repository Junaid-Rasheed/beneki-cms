'use strict';

/**
 * Scoped order reads for shoppers.
 * Authenticated users must not use GET /api/orders (find), which returns every order.
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/userorder/next-number',
      handler: 'order.nextOrderNumber',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/userorder/next-invoice-id',
      handler: 'order.nextInvoiceId',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/userorder',
      handler: 'order.userOrders',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/userorder/:id',
      handler: 'order.userOrder',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
