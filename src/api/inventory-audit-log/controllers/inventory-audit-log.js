'use strict';

/**
 * inventory-audit-log controller
 * Rows are written by the inventory controller. Content API stays read-only.
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::inventory-audit-log.inventory-audit-log'
);
