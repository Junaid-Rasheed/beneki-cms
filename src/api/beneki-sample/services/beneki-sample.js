'use strict';

/**
 * beneki-sample service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::beneki-sample.beneki-sample');
