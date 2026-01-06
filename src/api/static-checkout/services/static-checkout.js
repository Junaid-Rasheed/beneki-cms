'use strict';

/**
 * static-checkout service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-checkout.static-checkout');
