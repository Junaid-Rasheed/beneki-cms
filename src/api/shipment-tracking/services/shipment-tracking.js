'use strict';

/**
 * shipment-tracking service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::shipment-tracking.shipment-tracking');
