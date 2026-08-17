'use strict';

const { findDelayedDpdOrders } = require('../services/delayed-dpd-order');

async function requireAdminUser(strapi, ctx) {
  const userId = ctx.state.user?.id;
  if (!userId) {
    ctx.unauthorized();
    return null;
  }

  const user = await strapi.db
    .query('plugin::users-permissions.user')
    .findOne({
      where: { id: userId },
      populate: ['role'],
    });

  const roleName = user?.role?.name || user?.role?.type;
  if (!user || roleName !== 'Admin') {
    ctx.forbidden('Admin role required');
    return null;
  }

  return user;
}

module.exports = {
  /**
   * GET /api/delayed-dpd-orders
   * France DPD orders where every box was handed to DPD, still not delivered
   * after the handover-based delivery forecast.
   * Query: page, pageSize, search
   */
  async find(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const { page = '1', pageSize = '25', search = '' } = ctx.query || {};

    try {
      const result = await findDelayedDpdOrders(strapi, {
        page,
        pageSize,
        search,
      });
      ctx.body = result;
    } catch (err) {
      strapi.log.error(`[delayed-dpd-order] find failed: ${err.message}`);
      return ctx.internalServerError('Failed to load delayed DPD orders');
    }
  },
};
