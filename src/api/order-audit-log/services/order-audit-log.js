'use strict';

/**
 * order-audit-log service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::order-audit-log.order-audit-log');
