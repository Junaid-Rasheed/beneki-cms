'use strict';

const { findMissingDpdOrders } = require('../services/missing-dpd-order');

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
   * GET /api/missing-dpd-orders
   * France DPD orders where some boxes were handed to DPD (and may already
   * be delivered) while others are still in production or were missed.
   * Query: page, pageSize, search
   */
  async find(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const { page = '1', pageSize = '25', search = '' } = ctx.query || {};

    try {
      const result = await findMissingDpdOrders(strapi, {
        page,
        pageSize,
        search,
      });
      ctx.body = result;
    } catch (err) {
      strapi.log.error(`[missing-dpd-order] find failed: ${err.message}`);
      return ctx.internalServerError('Failed to load missing DPD orders');
    }
  },
};
