'use strict';

const utils = require('@strapi/utils');
const {
  getAccountStatus,
  isAccountSuspended,
  isAccountBlockedFromAuth,
  canReapplyApplication,
} = require('../../utils/accountStatus');
const {
  sendRegistrationConfirmationEmail,
  resolveLocaleFromContext,
} = require('../../utils/sendRegistrationConfirmationEmail');

const { isStaffRole, findUsersRole } = require('../../utils/customerRole');

const { ApplicationError } = utils.errors;

const APPLICATION_PROFILE_FIELDS = [
  'accountType',
  'businessName',
  'businessRegistrationNumber',
  'businessRegistrationCountry',
  'vatNumber',
  'isValidVatNumber',
  'accommodationsCount',
  'website',
  'airbnbProfileUrl',
  'reasonForPurchase',
];

function pickApplicationProfile(body) {
  if (!body || typeof body !== 'object') return {};
  const profile = {};

  if (body.accountType === 'Individual' || body.accountType === 'Business') {
    profile.accountType = body.accountType;
  }

  for (const key of [
    'businessName',
    'businessRegistrationNumber',
    'businessRegistrationCountry',
    'website',
    'airbnbProfileUrl',
    'reasonForPurchase',
    'vatNumber',
  ]) {
    if (body[key] == null) continue;
    const value = String(body[key]).trim();
    if (value) profile[key] = value;
  }

  if (body.accommodationsCount != null && body.accommodationsCount !== '') {
    const count = parseInt(body.accommodationsCount, 10);
    if (Number.isFinite(count)) profile.accommodationsCount = count;
  }

  if (body.isValidVatNumber != null) {
    profile.isValidVatNumber =
      body.isValidVatNumber === true || body.isValidVatNumber === 'true';
  }

  return profile;
}

/** Fields end users must not set via Content API. */
const PROTECTED_USER_FIELDS = [
  'accountStatus',
  'isSuspended',
  'legacyAutoValidated',
  'legacyReapplyEligible',
  'legacyReapplyUsed',
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
        const suspended = isAccountSuspended(freshUser);
        throw new ApplicationError(
          suspended
            ? 'Your account has been suspended due to no activity. You can apply again.'
            : 'Your account is not approved for access yet.',
          {
            accountStatus: suspended
              ? 'suspended'
              : getAccountStatus(freshUser),
            isSuspended: suspended,
            canReapply: canReapplyApplication(freshUser),
          }
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

      // Never trust client accountStatus or role on register.
      // Pull application fields off the body first: stock register rejects
      // anything other than email, username, and password.
      const applicationProfile = pickApplicationProfile(ctx.request.body);
      if (ctx.request.body) {
        delete ctx.request.body.accountStatus;
        delete ctx.request.body.isSuspended;
        delete ctx.request.body.role;
        for (const key of APPLICATION_PROFILE_FIELDS) {
          delete ctx.request.body[key];
        }
      }

      await originalRegister(ctx);

      const user = ctx.body?.user;
      if (user?.id) {
        // New shoppers stay Public until an admin approves them.
        // Approval (account-review) promotes them to Authenticated.
        try {
          const publicRole = await findUsersRole(strapi, 'public');

          const patch = {
            ...applicationProfile,
          };
          if (user.accountStatus !== 'pending_review') {
            patch.accountStatus = 'pending_review';
          }
          if (publicRole) {
            patch.role = publicRole.id;
          } else {
            strapi.log.warn(
              `[register] No Public role found; user ${user.id} kept the default role`
            );
          }

          const updated = await strapi.db
            .query('plugin::users-permissions.user')
            .update({
              where: { id: user.id },
              data: patch,
            });
          if (ctx.body.user) {
            if (updated.accountStatus) {
              ctx.body.user.accountStatus = updated.accountStatus;
            }
            if (publicRole) {
              ctx.body.user.role = publicRole.id;
            }
          }
        } catch (err) {
          strapi.log.error(
            `[register] Failed to set Public role for user ${user.id}: ${err.message}`
          );
        }

        if (user.email) {
          try {
            // Applicant confirmation only. Admins are notified in the
            // storefront Applications menu, not by email.
            await sendRegistrationConfirmationEmail(strapi, {
              email: user.email,
              locale,
            });
          } catch (err) {
            strapi.log.error(
              `[registration-email] Failed registration email for ${user.email}: ${err.message}`
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
    // Public is allowed to update so signup can save the application,
    // but only on the caller's own record. Staff may update other users.
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    if (
      !isStaffRole(ctx.state.user) &&
      String(ctx.state.user.id) !== String(ctx.params?.id)
    ) {
      return ctx.forbidden('You can only update your own account');
    }

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
