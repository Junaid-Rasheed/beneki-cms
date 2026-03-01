'use strict';

/**
 * static-auth-reset-password service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-auth-reset-password.static-auth-reset-password');
