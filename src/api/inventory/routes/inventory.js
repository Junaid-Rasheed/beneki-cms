'use strict';

/**
 * inventory routes — Admin inventory management (storefront Account → Inventory).
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/inventories',
      handler: 'inventory.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/inventories/product-details/options',
      handler: 'inventory.productDetailOptions',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/inventories/:id',
      handler: 'inventory.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/inventories',
      handler: 'inventory.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/inventories/:id',
      handler: 'inventory.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/inventories/:id',
      handler: 'inventory.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/inventories/:id/adjust-stock',
      handler: 'inventory.adjustStock',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
