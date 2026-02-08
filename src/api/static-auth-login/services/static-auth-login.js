'use strict';

/**
 * static-auth-login service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-auth-login.static-auth-login');
