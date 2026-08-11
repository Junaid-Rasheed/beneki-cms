'use strict';

const ACCOUNT_REVIEW_ACTIONS = [
  'api::account-review.account-review.find',
  'api::account-review.account-review.findOne',
  'api::account-review.account-review.performAction',
];

const ACCOUNT_REAPPLY_ACTION =
  'api::account-review.account-review.reapply';

async function ensurePermission(strapi, role, action, label) {
  if (!role) return;
  const existing = await strapi.db
    .query('plugin::users-permissions.permission')
    .findOne({
      where: {
        action,
        role: role.id,
      },
    });
  if (existing) return;
  await strapi.db.query('plugin::users-permissions.permission').create({
    data: { action, role: role.id },
  });
  strapi.log.info(`[account-review] Enabled permission ${action} for ${label}`);
}

/**
 * Ensure Admin role can call account-review Content API routes.
 * Safe to re-run: skips actions that already exist.
 */
async function ensureAccountReviewPermissions(strapi) {
  const adminRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { name: 'Admin' } });

  if (!adminRole) {
    strapi.log.warn(
      '[account-review] No users-permissions role named "Admin"; skip permission bootstrap'
    );
  } else {
    for (const action of ACCOUNT_REVIEW_ACTIONS) {
      await ensurePermission(strapi, adminRole, action, 'Admin');
    }
  }

  // Re-apply is public (email+password in body) and also usable with Authenticated JWT.
  const authenticatedRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({
      where: {
        $or: [{ type: 'authenticated' }, { name: 'Authenticated' }],
      },
    });

  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({
      where: {
        $or: [{ type: 'public' }, { name: 'Public' }],
      },
    });

  await ensurePermission(
    strapi,
    authenticatedRole,
    ACCOUNT_REAPPLY_ACTION,
    'Authenticated'
  );
  await ensurePermission(strapi, publicRole, ACCOUNT_REAPPLY_ACTION, 'Public');

  if (!authenticatedRole) {
    strapi.log.warn(
      '[account-reapply] No Authenticated role; Authenticated reapply permission skipped'
    );
  }
  if (!publicRole) {
    strapi.log.warn(
      '[account-reapply] No Public role; Public reapply permission skipped'
    );
  }
}

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // users-permissions does not always pick up extension lifecycles.js;
    // subscribe explicitly so new accounts always start in pending_review.
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      beforeCreate(event) {
        const { data } = event.params;
        if (data) {
          data.accountStatus = 'pending_review';
        }
      },
    });

    try {
      await ensureAccountReviewPermissions(strapi);
    } catch (err) {
      strapi.log.error(
        `[account-review] Permission bootstrap failed: ${err.message}`
      );
    }
  },
};
