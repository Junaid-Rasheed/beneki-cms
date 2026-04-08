"use strict";

/** Max line items per user cart (abuse guard). */
const MAX_CART_ITEMS = 200;

module.exports = {
  /**
   * GET /api/cart/me — returns only the authenticated user's cart.
   */
  async me(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) {
      return ctx.unauthorized();
    }

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId,
      { fields: ["cart"] },
    );

    const cart = Array.isArray(user?.cart) ? user.cart : [];
    return { data: { cart } };
  },

  /**
   * PUT /api/cart/me — replaces cart. Body must be `{ cart: [...] }` only.
   * No other user fields are accepted or updated.
   */
  async updateMe(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) {
      return ctx.unauthorized();
    }

    const body = ctx.request.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return ctx.badRequest("Invalid body");
    }

    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== "cart") {
      return ctx.badRequest("Only { cart } is allowed in the body");
    }

    const incoming = body.cart;
    if (!Array.isArray(incoming)) {
      return ctx.badRequest("cart must be an array");
    }

    const cart = incoming.slice(0, MAX_CART_ITEMS);

    await strapi.entityService.update(
      "plugin::users-permissions.user",
      userId,
      { data: { cart } },
    );

    return { data: { cart } };
  },
};
