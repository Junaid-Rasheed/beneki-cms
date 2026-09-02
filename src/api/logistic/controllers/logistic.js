'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { resolveLocaleFromContext } = require('../../../utils/sendRegistrationConfirmationEmail');

module.exports = createCoreController('api::logistic.logistic', ({ strapi }) => ({
  /**
   * POST /api/logistic:notify
   * Body: { labelCount: number }
   * Emails on-duty logistics staff with the provided label count.
   */
  async notify(ctx) {
    const { labelCount } = ctx.request.body || {};

    if (labelCount === undefined || labelCount === null || labelCount === '') {
      return ctx.badRequest('labelCount is required');
    }

    const parsedLabelCount = Number(labelCount);
    if (!Number.isFinite(parsedLabelCount) || parsedLabelCount < 0) {
      return ctx.badRequest('labelCount must be a non-negative number');
    }

    const locale = resolveLocaleFromContext(ctx);

    try {
      const result = await strapi
        .service('api::logistic.logistic')
        .notifyOnDutyLogistics({ labelCount: parsedLabelCount, locale });

      ctx.body = result;
    } catch (err) {
      strapi.log.error(`[logistic] notify failed: ${err.message}`);
      return ctx.internalServerError('Failed to notify logistics staff');
    }
  },
}));
