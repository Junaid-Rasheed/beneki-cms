'use strict';

/**
 * inventory-audit-log service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService(
  'api::inventory-audit-log.inventory-audit-log'
);
