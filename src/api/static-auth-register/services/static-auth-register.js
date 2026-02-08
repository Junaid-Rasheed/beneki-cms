'use strict';

/**
 * static-auth-register service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-auth-register.static-auth-register');
