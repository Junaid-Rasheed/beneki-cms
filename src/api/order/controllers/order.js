'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { errors } = require('@strapi/utils');
const { markOrderAsCompleted } = require('../../../helpers/markOrderCompleted');
const {
  isCustomerRole,
  loadAuthUser,
  findOwnedByUser,
  omitRelationFilters,
} = require('../../../utils/customerRole');

const UID = 'api::order.order';

/**
 * Relations the storefront reads on a shopper's own order.
 * Loaded here so Authenticated does not need find on these collections
 * (that permission would list every row, not just this order's).
 */
const SHOPPER_POPULATE = {
  orderItems: {
    populate: {
      shipment_trackings: true,
    },
  },
  billingAddress: true,
  shippingAddress: true,
  coupon: true,
  user: true,
};

const USER_FIELDS_FOR_SHOPPER = [
  'id',
  'documentId',
  'username',
  'email',
  'firstName',
  'name',
  'displayName',
  'businessName',
];

const COUPON_FIELDS_FOR_SHOPPER = [
  'id',
  'documentId',
  'code',
  'discountType',
  'discountValue',
];

function pickFields(record, fields) {
  if (!record || typeof record !== 'object') return record;
  const picked = {};
  for (const field of fields) {
    if (record[field] !== undefined) picked[field] = record[field];
  }
  return picked;
}

function presentShopperOrder(order) {
  if (!order || typeof order !== 'object') return order;
  const next = { ...order };

  if (next.user && typeof next.user === 'object') {
    next.user = pickFields(next.user, USER_FIELDS_FOR_SHOPPER);
  }

  if (next.coupon && typeof next.coupon === 'object') {
    next.coupon = pickFields(next.coupon, COUPON_FIELDS_FOR_SHOPPER);
  }

  if (Array.isArray(next.orderItems)) {
    next.orderItems = next.orderItems.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const copy = { ...item };
      if (Array.isArray(copy.shipment_trackings)) {
        copy.shipment_trackings = copy.shipment_trackings.map((tracking) => {
          if (!tracking || typeof tracking !== 'object') return tracking;
          const safe = { ...tracking };
          delete safe.labelData;
          return safe;
        });
      }
      return copy;
    });
  }

  return next;
}

async function shopperQuery(ctx) {
  const schema = strapi.contentType(UID);
  // No auth: relation filters (billing address, items) stay, without
  // requiring find permission on those collections.
  await strapi.contentAPI.validate.query(ctx.query, schema, {});
  return strapi.contentAPI.sanitize.query(ctx.query, schema, {});
}

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

function assertData(body) {
  if (!body?.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    throw new errors.ValidationError('Missing "data" payload in the request body');
  }
}

function scopeFiltersToUser(sanitizedQuery, userId) {
  const filters = { ...(sanitizedQuery.filters || {}) };
  delete filters.user;
  const owner = { user: { id: { $eq: userId } } };
  sanitizedQuery.filters =
    Object.keys(filters).length > 0 ? { $and: [filters, owner] } : owner;
  return sanitizedQuery;
}

async function reserveNextOrderNumber(strapi) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const latest = await strapi.db.query(UID).findMany({
      orderBy: { createdAt: 'desc' },
      limit: 1,
      select: ['orderNumber'],
    });

    let candidate = 'ORD-0000001';
    const latestOrderNumber = latest[0]?.orderNumber;
    if (latestOrderNumber && String(latestOrderNumber).startsWith('ORD-')) {
      const numericPart = parseInt(
        String(latestOrderNumber).replace('ORD-', ''),
        10
      );
      if (Number.isFinite(numericPart)) {
        candidate = `ORD-${String(numericPart + 1).padStart(7, '0')}`;
      }
    }

    const taken = await strapi.db.query(UID).findOne({
      where: { orderNumber: candidate },
      select: ['id'],
    });
    if (!taken) return candidate;
  }

  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `ORD-${timestamp.toString().slice(-4)}${randomNum}`;
}

async function reserveNextInvoiceId(strapi) {
  const latest = await strapi.db.query(UID).findMany({
    where: { invoiceId: { $notNull: true } },
    orderBy: { invoiceId: 'desc' },
    limit: 1,
    select: ['invoiceId'],
  });

  const latestInvoiceId = latest[0]?.invoiceId;
  if (latestInvoiceId == null) return 1;

  const numericPart = parseInt(latestInvoiceId, 10);
  if (Number.isNaN(numericPart)) return 1;
  return numericPart + 1;
}

module.exports = createCoreController(UID, ({ strapi }) => ({
  /**
   * Unscoped list. Shoppers are rejected so a Users/Orders find permission
   * cannot be used to read every order. Staff keep this route.
   */
  async find(ctx) {
    const user = await loadAuthUser(strapi, ctx);
    if (user && isCustomerRole(user)) {
      return ctx.forbidden('Use /api/userorder to read your orders');
    }

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const { results, pagination } = await strapi.service(UID).find(sanitizedQuery);
    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, { pagination });
  },

  async findOne(ctx) {
    const user = await loadAuthUser(strapi, ctx);
    if (user && isCustomerRole(user)) {
      const owned = await findOwnedByUser(
        strapi,
        UID,
        'user',
        ctx.params.id,
        user.id
      );
      if (!owned) return ctx.notFound('Order not found');

      const entity = await strapi.service(UID).findOne(ctx.params.id, {
        populate: SHOPPER_POPULATE,
      });
      if (!entity) return ctx.notFound('Order not found');
      return this.transformResponse(presentShopperOrder(entity));
    }

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const entity = await strapi.service(UID).findOne(ctx.params.id, sanitizedQuery);
    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitizedEntity);
  },

  /**
   * Shoppers cannot be trusted to send the user relation: saving it requires
   * Users find, which lists every account. Stamp the JWT user instead.
   */
  async create(ctx) {
    const user = await loadAuthUser(strapi, ctx);

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const { body = {} } = ctx.request;
    assertData(body);

    if (user && isCustomerRole(user)) {
      delete body.data.user;
    }

    await this.validateInput(body.data, ctx);
    const data = await this.sanitizeInput(body.data, ctx);

    if (user && isCustomerRole(user)) {
      data.user = user.documentId || user.id;
    }

    const entity = await strapi.service(UID).create({
      ...sanitizedQuery,
      data,
    });
    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    ctx.status = 201;
    return this.transformResponse(sanitizedEntity);
  },

  async update(ctx) {
    const user = await loadAuthUser(strapi, ctx);
    const customer = user && isCustomerRole(user);
    if (customer) {
      const owned = await findOwnedByUser(
        strapi,
        UID,
        'user',
        ctx.params.id,
        user.id
      );
      if (!owned) return ctx.notFound('Order not found');
    }

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const { body = {} } = ctx.request;
    assertData(body);
    if (customer) {
      delete body.data.user;
    }

    await this.validateInput(body.data, ctx);
    const data = await this.sanitizeInput(body.data, ctx);
    if (customer) {
      delete data.user;
    }

    const entity = await strapi.service(UID).update(ctx.params.id, {
      ...sanitizedQuery,
      data,
    });
    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitizedEntity);
  },

  async delete(ctx) {
    const user = await loadAuthUser(strapi, ctx);
    if (user && isCustomerRole(user)) {
      const owned = await findOwnedByUser(
        strapi,
        UID,
        'user',
        ctx.params.id,
        user.id
      );
      if (!owned) return ctx.notFound('Order not found');
    }

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const entity = await strapi.service(UID).delete(ctx.params.id, sanitizedQuery);
    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitizedEntity);
  },

  /** GET /api/userorder — only the authenticated user's orders, with relations. */
  async userOrders(ctx) {
    const user = await loadAuthUser(strapi, ctx);
    if (!user) return ctx.unauthorized();

    if (ctx.query?.filters) {
      ctx.query.filters = omitRelationFilters(ctx.query.filters, 'user');
    }

    const sanitizedQuery = await shopperQuery(ctx);
    scopeFiltersToUser(sanitizedQuery, user.id);
    sanitizedQuery.populate = SHOPPER_POPULATE;

    const { results, pagination } = await strapi.service(UID).find(sanitizedQuery);
    const data = (results || []).map(presentShopperOrder);
    return this.transformResponse(data, { pagination });
  },

  /** GET /api/userorder/:id — one order, only when it belongs to the caller. */
  async userOrder(ctx) {
    const user = await loadAuthUser(strapi, ctx);
    if (!user) return ctx.unauthorized();

    const owned = await findOwnedByUser(
      strapi,
      UID,
      'user',
      ctx.params.id,
      user.id
    );
    if (!owned) return ctx.notFound('Order not found');

    const entity = await strapi.service(UID).findOne(ctx.params.id, {
      populate: SHOPPER_POPULATE,
    });
    if (!entity) return ctx.notFound('Order not found');
    return this.transformResponse(presentShopperOrder(entity));
  },

  /** GET /api/userorder/next-number — next ORD- number without listing orders. */
  async nextOrderNumber(ctx) {
    const orderNumber = await reserveNextOrderNumber(strapi);
    ctx.body = { data: { orderNumber } };
  },

  /** GET /api/userorder/next-invoice-id — next invoice id without listing orders. */
  async nextInvoiceId(ctx) {
    const invoiceId = await reserveNextInvoiceId(strapi);
    ctx.body = { data: { invoiceId } };
  },

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
