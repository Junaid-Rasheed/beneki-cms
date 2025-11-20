'use strict';

/**
 * static-content service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-content.static-content');
