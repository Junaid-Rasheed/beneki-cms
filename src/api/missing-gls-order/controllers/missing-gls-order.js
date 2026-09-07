'use strict';

const { findMissingGlsOrders } = require('../services/missing-gls-order');

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
   * GET /api/missing-gls-orders
   * Non-France GLS orders where some boxes were handed to GLS (and may already
   * be delivered) while others are still in production or were missed.
   * Query: page, pageSize, search
   */
  async find(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const { page = '1', pageSize = '25', search = '' } = ctx.query || {};

    try {
      const result = await findMissingGlsOrders(strapi, {
        page,
        pageSize,
        search,
      });
      ctx.body = result;
    } catch (err) {
      strapi.log.error(`[missing-gls-order] find failed: ${err.message}`);
      return ctx.internalServerError('Failed to load missing GLS orders');
    }
  },
};
