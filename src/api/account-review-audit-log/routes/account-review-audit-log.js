'use strict';

/**
 * account-review-audit-log router
 * Create is used internally by account-review service; keep Content API locked down.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter(
  'api::account-review-audit-log.account-review-audit-log',
  {
    only: ['find', 'findOne'],
  }
);
