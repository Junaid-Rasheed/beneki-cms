'use strict';

/**
 * static-payment service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-payment.static-payment');
