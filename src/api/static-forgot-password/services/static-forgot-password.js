'use strict';

/**
 * static-forgot-password service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-forgot-password.static-forgot-password');
