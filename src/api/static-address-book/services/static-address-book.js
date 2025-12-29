'use strict';

/**
 * static-address-book service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-address-book.static-address-book');
