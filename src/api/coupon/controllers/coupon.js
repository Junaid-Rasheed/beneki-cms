'use strict';

/**
 * coupon controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::coupon.coupon', ({ strapi }) => ({
  // Custom endpoint to apply coupon
  async apply(ctx) {
    try {
      const { code, cartTotal, userId } = ctx.request.body;

      if (!code || !cartTotal) {
        return ctx.badRequest('Code and cart total are required');
      }

      // Find coupon by code
      const coupon = await strapi.db.query('api::coupon.coupon').findOne({
        where: {
          code: code.toUpperCase(),
          isActive: true
        },
        populate: {
          assignedAffiliatedUser: true
        }
      });

      
      if (!coupon) {
        return ctx.notFound('Coupon not found or inactive');
      }
      const couponId= coupon.id;
      // Check expiration date
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return ctx.badRequest('Coupon expired');
      }

      // Check usage limit
      if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
        return ctx.badRequest('Coupon usage limit reached');
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discountType === 'percentage') {
        discountAmount = (cartTotal * coupon.discountValue) / 100;
      } else if (coupon.discountType === 'fixed') {
        discountAmount = coupon.discountValue;
      }

      if (discountAmount > cartTotal) {
        discountAmount = cartTotal;
      }

      const finalTotal = cartTotal - discountAmount;

      const userUsageCount = await strapi.db
                              .query('api::order.order')
                              .count({
                                where: {
                                  user: userId,
                                  coupon: couponId,
                                },
                              });
      // // Increment usage count
      // await strapi.db.query('api::coupon.coupon').update({
      //   where: { id: coupon.id },
      //   data: { usageCount: coupon.usageCount + 1 }
      // });

      return {
        success: true,
        discountAmount,
        finalTotal,
        coupon,
        userUsageCount,
        message: `Coupon applied successfully`
      };

    } catch (error) {
      console.error(error);
      return ctx.internalServerError('Error applying coupon');
    }
  }
}));