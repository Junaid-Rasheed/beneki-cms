'use strict';

/**
 * coupon controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::coupon.coupon', ({ strapi }) => ({
  // Custom endpoint to apply coupon
  async apply(ctx) {
    try {
      const { code, cartTotal, userId,userDocumentId, email, cartItems } = ctx.request.body;

      if (!code || cartTotal == null) {
        return ctx.badRequest('Code and cart total are required');
      }

      // ===============================
      // 🔍 FIND COUPON
      // ===============================
      const coupon = await strapi.db.query('api::coupon.coupon').findOne({
        where: {
          code: code.toUpperCase(),
          isActive: true
        },
        populate: {
          assignedAffiliatedUser: true,
          includedProducts: true,
          excludedProducts: true,
          allowedUsers: true
        }
      });

      if (!coupon) {
        return ctx.notFound('Coupon not found or inactive');
      }

      const couponId = coupon.id;

      // ===============================
      // ⏳ EXPIRATION CHECK
      // ===============================
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return ctx.badRequest('Coupon expired');
      }

      // ===============================
      // 📊 GLOBAL USAGE LIMIT CHECK
      // ===============================
      if (
        coupon.maxUsage != null &&
        coupon.maxUsage > 0 &&
        coupon.usageCount >= coupon.maxUsage
      ) {
        return ctx.badRequest('Coupon usage limit reached');
      }
      

      // ===============================
      // 👤 STRICT USER VALIDATION
      // ===============================
      console.log("allowedUser", coupon)
      if (coupon.allowedUsers && coupon.allowedUsers.length > 0) {
        const allowedUserIds = coupon.allowedUsers.map(u => u.documentId);

        if (!allowedUserIds.includes(userDocumentId)) {
          return ctx.badRequest('This coupon is not assigned to your account');
        }
      }

      // ===============================
      // 📧 STRICT DOMAIN VALIDATION
      // ===============================
      if (coupon.allowedEmailDomains && coupon.allowedEmailDomains.length > 0) {

        if (!email) {
          return ctx.badRequest('Email is required for this coupon');
        }

        const domain = email.split('@')[1]?.toLowerCase();
        const allowedDomains = coupon.allowedEmailDomains.map(d =>
          d.toLowerCase()
        );

        if (!allowedDomains.includes(domain)) {
          return ctx.badRequest(
            'This coupon is not valid for your email domain'
          );
        }
      }

      // ===============================
      // 🛒 CALCULATE ELIGIBLE TOTAL
      // ===============================
      let eligibleTotal = cartTotal;

      if (cartItems && cartItems.length > 0) {

        const includedIds = coupon.includedProducts?.map(p => p.documentId) || [];
        const excludedIds = coupon.excludedProducts?.map(p => p.documentId) || [];

        eligibleTotal = 0;

        for (const item of cartItems) {

          const productId = item.productId;
          const lineTotal = Number(item.lineTotal || 0);

          let isEligible = true;

          // If included products exist → only those eligible
          if (includedIds.length > 0) {
            isEligible = includedIds.includes(productId);
          }

          // If excluded products exist → remove those
          if (excludedIds.length > 0 && excludedIds.includes(productId)) {
            isEligible = false;
          }

          if (isEligible) {
            eligibleTotal += lineTotal;
          }
        }
      }

      // ===============================
      // 💰 CALCULATE DISCOUNT
      // ===============================
      let discountAmount = 0;

      if (eligibleTotal > 0) {

        if (coupon.discountType === 'percentage') {
          discountAmount = (eligibleTotal * coupon.discountValue) / 100;
        }
        else if (coupon.discountType === 'fixed') {

          discountAmount = coupon.discountValue;

          // Prevent over-discounting
          if (discountAmount > eligibleTotal) {
            discountAmount = eligibleTotal;
          }
        }
      }

      const finalTotal = cartTotal - discountAmount;

      // ===============================
      // 📊 USER USAGE COUNT
      // ===============================
      const userUsageCount = await strapi.db
        .query('api::order.order')
        .count({
          where: {
            user: userId,
            coupon: couponId,
          },
        });

      // ===============================
      // ✅ SUCCESS RESPONSE
      // ===============================
      return {
        success: true,
        discountAmount,
        finalTotal,
        coupon,
        userUsageCount,
        message:
          discountAmount > 0
            ? 'Coupon applied successfully'
            : 'Coupon valid but no eligible products in cart'
      };

    } catch (error) {
      console.error(error);
      return ctx.internalServerError('Error applying coupon');
    }
  }
}));