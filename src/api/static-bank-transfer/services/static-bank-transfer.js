'use strict';

/**
 * static-bank-transfer service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::static-bank-transfer.static-bank-transfer');
