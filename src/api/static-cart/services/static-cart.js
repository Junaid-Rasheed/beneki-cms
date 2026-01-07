'use strict';

/**
 * static-cart service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-cart.static-cart');
