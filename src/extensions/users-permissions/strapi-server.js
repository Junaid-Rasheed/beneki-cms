'use strict';

const utils = require('@strapi/utils');
const {
  getAccountStatus,
  isAccountBlockedFromAuth,
} = require('../../utils/accountStatus');
const {
  sendRegistrationConfirmationEmail,
  sendRegistrationAdminNotifyEmail,
  resolveLocaleFromContext,
} = require('../../utils/sendRegistrationConfirmationEmail');

const { ApplicationError } = utils.errors;

/** Fields end users must not set via Content API. */
const PROTECTED_USER_FIELDS = [
  'accountStatus',
  'legacyAutoValidated',
  'accountReviewedAt',
  'accountReviewedByName',
  'accountReviewedByEmail',
  'blocked',
  'confirmed',
  'role',
  'provider',
  'resetPasswordToken',
  'confirmationToken',
];

module.exports = (plugin) => {
  // --- Auth controller overrides (factory pattern) ---
  const originalAuthFactory = plugin.controllers.auth;

  plugin.controllers.auth = ({ strapi }) => {
    const originalAuth = originalAuthFactory({ strapi });

    const originalCallback = originalAuth.callback;
    originalAuth.callback = async (ctx) => {
      await originalCallback(ctx);

      // Refuse shop access JWT when account is not approved.
      // Legacy users with null/empty accountStatus remain allowed.
      const userId = ctx.body?.user?.id;
      if (!userId) return;

      const freshUser = await strapi.db
        .query('plugin::users-permissions.user')
        .findOne({ where: { id: userId } });

      if (freshUser && isAccountBlockedFromAuth(freshUser)) {
        ctx.body = undefined;
        throw new ApplicationError(
          'Your account is not approved for access yet.',
          { accountStatus: getAccountStatus(freshUser) }
        );
      }
    };

    const originalRegister = originalAuth.register;
    originalAuth.register = async (ctx) => {
      // locale is not a user field — strip before stock register validates keys
      const locale = resolveLocaleFromContext(ctx);
      if (ctx.request.body?.locale !== undefined) {
        delete ctx.request.body.locale;
      }

      // Never trust client accountStatus on register
      if (ctx.request.body?.accountStatus !== undefined) {
        delete ctx.request.body.accountStatus;
      }

      await originalRegister(ctx);

      const user = ctx.body?.user;
      if (user?.id) {
        // Ensure pending_review even if a client somehow bypassed create hooks
        if (user.accountStatus !== 'pending_review') {
          try {
            const updated = await strapi.db
              .query('plugin::users-permissions.user')
              .update({
                where: { id: user.id },
                data: { accountStatus: 'pending_review' },
              });
            if (ctx.body.user) {
              ctx.body.user.accountStatus = updated.accountStatus;
            }
          } catch (err) {
            strapi.log.error(
              `[register] Failed to force pending_review for user ${user.id}: ${err.message}`
            );
          }
        }

        if (user.email) {
          try {
            await sendRegistrationConfirmationEmail(strapi, {
              email: user.email,
              locale,
            });

            await sendRegistrationAdminNotifyEmail(strapi, {
              applicant: {
                id: user.id,
                email: user.email,
                username: user.username,
                accountStatus: user.accountStatus || 'pending_review',
              },
              locale: 'en',
            });
          } catch (err) {
            strapi.log.error(
              `[registration-email] Failed registration emails for ${user.email}: ${err.message}`
            );
          }
        }
      }

      // Registration JWT is only for completing the profile PUT — not shop access.
      // Frontend discards it; login will refuse non-approved accounts.
      // Keep jwt in response so the existing FE PUT /users/:id still works.
    };

    return originalAuth;
  };

  // --- User controller: strip protected fields on Content API update ---
  const originalUserUpdate = plugin.controllers.user.update;
  plugin.controllers.user.update = async (ctx) => {
    if (ctx.request.body) {
      for (const field of PROTECTED_USER_FIELDS) {
        delete ctx.request.body[field];
      }
    }

    const userId = ctx.params?.id;
    let previousStatus = null;
    if (userId) {
      try {
        const existing = await strapi.db
          .query('plugin::users-permissions.user')
          .findOne({ where: { id: userId } });
        previousStatus = existing ? getAccountStatus(existing) : null;
      } catch (_) {
        /* ignore */
      }
    }

    const result = await originalUserUpdate(ctx);

    // Resubmission after "request more info" → back to pending_review.
    if (
      previousStatus === 'more_info_requested' &&
      userId &&
      ctx.state.user?.id &&
      String(ctx.state.user.id) === String(userId)
    ) {
      try {
        const updated = await strapi.db
          .query('plugin::users-permissions.user')
          .update({
            where: { id: userId },
            data: { accountStatus: 'pending_review' },
          });
        if (result && typeof result === 'object') {
          result.accountStatus = updated.accountStatus;
        }
        if (ctx.body?.accountStatus !== undefined) {
          ctx.body.accountStatus = updated.accountStatus;
        }
      } catch (err) {
        strapi.log.error(
          `[account-review] Failed to reset pending_review after resubmit for user ${userId}: ${err.message}`
        );
      }
    }

    return result;
  };

  return plugin;
};
