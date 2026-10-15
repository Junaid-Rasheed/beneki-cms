'use strict';

/**
 * inventory-audit-log router
 * Create/update/delete stay internal. Staff read logs through inventory routes.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter(
  'api::inventory-audit-log.inventory-audit-log',
  {
    only: ['find', 'findOne'],
  }
);
