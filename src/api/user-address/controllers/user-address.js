'use strict';

/**
 * user-address controller
 *
 * Linking an address to a user normally requires the Users "find" permission,
 * because Strapi strips relations the caller cannot find. Shoppers must not
 * have that permission (it lists every user), so the owner is taken from the
 * JWT after input sanitization.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { errors } = require('@strapi/utils');
const {
  isAdminRole,
  loadAuthUser,
  findOwnedByUser,
  omitRelationFilters,
} = require('../../../utils/customerRole');

const UID = 'api::user-address.user-address';

function assertData(body) {
  if (!body?.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    throw new errors.ValidationError('Missing "data" payload in the request body');
  }
}

function scopeFiltersToUser(sanitizedQuery, userId) {
  const filters = { ...(sanitizedQuery.filters || {}) };
  delete filters.users_permissions_user;
  const owner = { users_permissions_user: { id: { $eq: userId } } };
  sanitizedQuery.filters =
    Object.keys(filters).length > 0 ? { $and: [filters, owner] } : owner;
  return sanitizedQuery;
}

module.exports = createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const user = await loadAuthUser(strapi, ctx);
    if (!user) return ctx.unauthorized();

    // The address book filters by owner. That filter is rejected unless the
    // role can find Users, so drop it and apply the JWT user after validation.
    if (!isAdminRole(user) && ctx.query?.filters) {
      ctx.query.filters = omitRelationFilters(
        ctx.query.filters,
        'users_permissions_user'
      );
    }

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);

    // Without Users find, a client filter on the owner is stripped and this
    // would return every address. Force the caller, except Admin.
    if (!isAdminRole(user)) {
      scopeFiltersToUser(sanitizedQuery, user.id);
    }

    const { results, pagination } = await strapi.service(UID).find(sanitizedQuery);
    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, { pagination });
  },

  async findOne(ctx) {
    const user = await loadAuthUser(strapi, ctx);
    if (!user) return ctx.unauthorized();

    if (!isAdminRole(user)) {
      const owned = await findOwnedByUser(
        strapi,
        UID,
        'users_permissions_user',
        ctx.params.id,
        user.id
      );
      if (!owned) return ctx.notFound('Address not found');
    }

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const entity = await strapi.service(UID).findOne(ctx.params.id, sanitizedQuery);
    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitizedEntity);
  },

  async create(ctx) {
    const user = await loadAuthUser(strapi, ctx);
    if (!user) return ctx.unauthorized();

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const { body = {} } = ctx.request;
    assertData(body);

    const admin = isAdminRole(user);
    if (!admin) {
      delete body.data.users_permissions_user;
    }

    await this.validateInput(body.data, ctx);
    const data = await this.sanitizeInput(body.data, ctx);

    if (!admin || !data.users_permissions_user) {
      // Set after sanitizeInput. That step removes the user relation unless
      // the role has Users find, which shoppers must not have.
      data.users_permissions_user = user.documentId || user.id;
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
    if (!user) return ctx.unauthorized();

    const admin = isAdminRole(user);
    if (!admin) {
      const owned = await findOwnedByUser(
        strapi,
        UID,
        'users_permissions_user',
        ctx.params.id,
        user.id
      );
      if (!owned) return ctx.notFound('Address not found');
    }

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const { body = {} } = ctx.request;
    assertData(body);

    if (!admin) {
      delete body.data.users_permissions_user;
    }

    await this.validateInput(body.data, ctx);
    const data = await this.sanitizeInput(body.data, ctx);
    if (!admin) {
      delete data.users_permissions_user;
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
    if (!user) return ctx.unauthorized();

    if (!isAdminRole(user)) {
      const owned = await findOwnedByUser(
        strapi,
        UID,
        'users_permissions_user',
        ctx.params.id,
        user.id
      );
      if (!owned) return ctx.notFound('Address not found');
    }

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    await strapi.service(UID).delete(ctx.params.id, sanitizedQuery);
    ctx.status = 204;
  },
}));
