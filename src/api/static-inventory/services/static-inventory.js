'use strict';

/**
 * static-inventory service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-inventory.static-inventory');
