'use strict';

/**
 * cgv service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::cgv.cgv');
