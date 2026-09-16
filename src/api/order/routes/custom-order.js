'use strict';

/**
 * Custom order routes — Admin mark delayed/missed carrier orders completed.
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/orders/:documentId/mark-as-completed',
      handler: 'order.markAsCompleted',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
