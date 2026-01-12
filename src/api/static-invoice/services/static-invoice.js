'use strict';

/**
 * static-invoice service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-invoice.static-invoice');
