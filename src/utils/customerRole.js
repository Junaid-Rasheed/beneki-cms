'use strict';

const STAFF_ROLE_TOKENS = new Set([
  'admin',
  'affiliate',
  'logistic',
  'logistics',
  'production',
]);

function roleToken(user) {
  const role = user?.role;
  if (!role) return '';
  if (typeof role === 'string') return role.trim().toLowerCase();
  return String(role.type || role.name || '')
    .trim()
    .toLowerCase();
}

/** Storefront shoppers: Public before approval, Authenticated after. */
function isCustomerRole(user) {
  const token = roleToken(user);
  return token === 'public' || token === 'authenticated';
}

function isAdminRole(user) {
  return roleToken(user) === 'admin';
}

function isStaffRole(user) {
  return STAFF_ROLE_TOKENS.has(roleToken(user));
}

async function findUsersRole(strapi, type) {
  const name =
    type === 'public'
      ? 'Public'
      : type === 'authenticated'
        ? 'Authenticated'
        : type;

  return strapi.db.query('plugin::users-permissions.role').findOne({
    where: {
      $or: [{ type }, { name }],
    },
  });
}

async function loadAuthUser(strapi, ctx) {
  const current = ctx.state?.user;
  if (!current?.id) return null;
  if (current.role && current.documentId) return current;
  return strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: current.id },
    populate: ['role'],
  });
}

/**
 * Drop a relation from filters before query validation.
 * Strapi rejects filters on relations the role cannot find (Users find).
 * Empty branches are removed so a stripped OR clause does not match everything.
 */
function omitRelationFilters(value, relationKey) {
  if (Array.isArray(value)) {
    return value
      .map((item) => omitRelationFilters(item, relationKey))
      .filter((item) => {
        if (Array.isArray(item)) return item.length > 0;
        if (item && typeof item === 'object') return Object.keys(item).length > 0;
        return item != null;
      });
  }

  if (!value || typeof value !== 'object') return value;

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === relationKey) continue;
    const cleaned = omitRelationFilters(child, relationKey);
    if (Array.isArray(cleaned)) {
      if (cleaned.length > 0) next[key] = cleaned;
      continue;
    }
    if (cleaned && typeof cleaned === 'object') {
      if (Object.keys(cleaned).length > 0) next[key] = cleaned;
      continue;
    }
    if (cleaned !== undefined) next[key] = cleaned;
  }
  return next;
}

/**
 * An entry linked to this user, matched by documentId or numeric id.
 */
async function findOwnedByUser(strapi, uid, relation, idParam, userId) {
  const byDocument = await strapi.db.query(uid).findOne({
    where: {
      [relation]: userId,
      documentId: String(idParam),
    },
  });
  if (byDocument) return byDocument;

  const numeric = Number(idParam);
  if (!Number.isInteger(numeric) || String(numeric) !== String(idParam).trim()) {
    return null;
  }

  return strapi.db.query(uid).findOne({
    where: {
      [relation]: userId,
      id: numeric,
    },
  });
}

module.exports = {
  roleToken,
  isCustomerRole,
  isAdminRole,
  isStaffRole,
  findUsersRole,
  loadAuthUser,
  findOwnedByUser,
  omitRelationFilters,
};
