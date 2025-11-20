'use strict';

/**
 * static-content router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::static-content.static-content');
