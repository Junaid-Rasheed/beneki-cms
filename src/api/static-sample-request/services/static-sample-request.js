'use strict';

/**
 * static-sample-request service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-sample-request.static-sample-request');
