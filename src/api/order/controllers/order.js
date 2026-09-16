'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { markOrderAsCompleted } = require('../../../helpers/markOrderCompleted');

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

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
  /**
   * POST /api/orders/:documentId/mark-as-completed
   * Sets undelivered box trackings to delivered and orderStatus to delivered.
   */
  async markAsCompleted(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const documentId = ctx.params.documentId || ctx.params.id;
    if (!documentId) {
      return ctx.badRequest('Order documentId is required');
    }

    try {
      const result = await markOrderAsCompleted(strapi, documentId);
      ctx.body = {
        success: true,
        message: 'Order marked as completed',
        data: result,
      };
    } catch (err) {
      const status = err.status || 500;
      strapi.log.error(
        `[order.markAsCompleted] failed for ${documentId}: ${err.message}`
      );
      if (status === 404) return ctx.notFound(err.message);
      if (status === 400) return ctx.badRequest(err.message);
      return ctx.internalServerError('Failed to mark order as completed');
    }
  },
}));
