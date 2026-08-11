'use strict';

const {
  ACCOUNT_STATUS,
  REVIEW_ACTIONS,
  ACTION_TO_STATUS,
  getAccountStatus,
  isLegacyAutoValidated,
  canReapplyApplication,
} = require('../../../utils/accountStatus');
const {
  sendAccountReviewDecisionEmail,
  sendRegistrationConfirmationEmail,
  sendRegistrationAdminNotifyEmail,
  resolveLocaleFromContext,
} = require('../../../utils/sendRegistrationConfirmationEmail');

const APPLICATION_FIELDS = [
  'id',
  'documentId',
  'username',
  'email',
  'firstName',
  'name',
  'displayName',
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
  'accountStatus',
  'legacyAutoValidated',
  'legacyReapplyEligible',
  'legacyReapplyUsed',
  'accountReviewedAt',
  'accountReviewedByName',
  'accountReviewedByEmail',
  'createdAt',
  'updatedAt',
];

const STATUS_FILTER_MAP = {
  pending: ACCOUNT_STATUS.PENDING_REVIEW,
  pending_review: ACCOUNT_STATUS.PENDING_REVIEW,
  'more-info-requested': ACCOUNT_STATUS.MORE_INFO_REQUESTED,
  more_info_requested: ACCOUNT_STATUS.MORE_INFO_REQUESTED,
  approved: ACCOUNT_STATUS.APPROVED,
  refused: ACCOUNT_STATUS.REFUSED,
  'rejected-without-notification':
    ACCOUNT_STATUS.REJECTED_WITHOUT_NOTIFICATION,
  rejected_without_notification:
    ACCOUNT_STATUS.REJECTED_WITHOUT_NOTIFICATION,
};

function pickApplicationFields(user) {
  if (!user) return null;
  const out = {};
  for (const key of APPLICATION_FIELDS) {
    if (user[key] !== undefined) out[key] = user[key];
  }
  out.accountStatus = getAccountStatus(user);
  out.legacyAutoValidated = isLegacyAutoValidated(user);
  return out;
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

async function countOrdersForUser(strapi, userId) {
  try {
    return await strapi.db.query('api::order.order').count({
      where: { user: userId },
    });
  } catch (err) {
    strapi.log.warn(
      `[account-review] Failed to count orders for user ${userId}: ${err.message}`
    );
    return 0;
  }
}

async function writeAuditLog(strapi, entry) {
  return strapi.db
    .query('api::account-review-audit-log.account-review-audit-log')
    .create({ data: entry });
}

module.exports = {
  /**
   * GET /api/account-reviews
   * Query: status, page, pageSize, search, legacyOnly
   */
  async find(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const {
      status = 'all',
      page = '1',
      pageSize = '25',
      search = '',
      legacyOnly = '',
    } = ctx.query || {};

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
    const where = {};

    const normalizedStatus = String(status || 'all').trim().toLowerCase();
    if (normalizedStatus !== 'all') {
      const mapped = STATUS_FILTER_MAP[normalizedStatus];
      if (!mapped) {
        return ctx.badRequest(`Unknown status filter: ${status}`);
      }
      where.accountStatus = mapped;
    } else {
      // Applications that entered review, or 2026 auto-validated legacy accounts.
      where.$or = [
        {
          accountStatus: {
            $in: [
              ACCOUNT_STATUS.PENDING_REVIEW,
              ACCOUNT_STATUS.MORE_INFO_REQUESTED,
              ACCOUNT_STATUS.REFUSED,
              ACCOUNT_STATUS.REJECTED_WITHOUT_NOTIFICATION,
              ACCOUNT_STATUS.APPROVED,
            ],
          },
        },
        { legacyAutoValidated: true },
      ];
    }

    if (String(legacyOnly).toLowerCase() === 'true') {
      where.legacyAutoValidated = true;
    }

    const searchTerm = String(search || '').trim();
    if (searchTerm) {
      const searchClause = {
        $or: [
          { email: { $containsi: searchTerm } },
          { username: { $containsi: searchTerm } },
          { businessName: { $containsi: searchTerm } },
          { firstName: { $containsi: searchTerm } },
          { name: { $containsi: searchTerm } },
        ],
      };
      if (where.$or) {
        where.$and = [{ $or: where.$or }, searchClause];
        delete where.$or;
      } else {
        where.$and = [...(where.$and || []), searchClause];
      }
    }

    const [users, total] = await Promise.all([
      strapi.db.query('plugin::users-permissions.user').findMany({
        where,
        orderBy: { createdAt: 'desc' },
        offset: (pageNum - 1) * size,
        limit: size,
      }),
      strapi.db.query('plugin::users-permissions.user').count({ where }),
    ]);

    const data = users.map((user) => ({
      ...pickApplicationFields(user),
      submittedAt: user.createdAt,
    }));

    ctx.body = {
      data,
      meta: {
        pagination: {
          page: pageNum,
          pageSize: size,
          pageCount: Math.max(1, Math.ceil(total / size)),
          total,
        },
      },
    };
  },

  /**
   * GET /api/account-reviews/:id
   */
  async findOne(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const id = ctx.params.id;
    if (!id) return ctx.badRequest('Missing application id');

    const user = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({
        where: { id },
      });

    if (!user) {
      return ctx.notFound('Application not found');
    }

    const [orderCount, auditTrail] = await Promise.all([
      countOrdersForUser(strapi, user.id),
      strapi.db
        .query('api::account-review-audit-log.account-review-audit-log')
        .findMany({
          where: { userId: String(user.id) },
          orderBy: { changedAt: 'desc' },
          limit: 50,
        }),
    ]);

    ctx.body = {
      data: {
        ...pickApplicationFields(user),
        submittedAt: user.createdAt,
        hasOrderHistory: orderCount > 0,
        orderCount,
        auditTrail,
      },
    };
  },

  /**
   * POST /api/account-reviews/:id/action
   * Body: { action, note?, locale? }
   * action: approve | request_more_info | refuse | reject_without_notification
   */
  async performAction(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const id = ctx.params.id;
    const body = ctx.request.body || {};
    const action = String(body.action || '')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_');
    const note = body.note != null ? String(body.note) : null;
    const locale = body.locale || 'en';

    if (!ACTION_TO_STATUS[action]) {
      return ctx.badRequest(
        `Invalid action. Expected one of: ${Object.values(REVIEW_ACTIONS).join(', ')}`
      );
    }

    if (
      action === REVIEW_ACTIONS.REQUEST_MORE_INFO &&
      !(note && String(note).trim())
    ) {
      return ctx.badRequest(
        'A message describing the information needed is required.'
      );
    }

    const user = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id } });

    if (!user) {
      return ctx.notFound('Application not found');
    }

    const previousStatus = getAccountStatus(user);
    const nextStatus = ACTION_TO_STATUS[action];
    const changedAt = new Date();
    const reviewerName =
      admin.displayName ||
      [admin.firstName, admin.name].filter(Boolean).join(' ').trim() ||
      admin.username ||
      admin.email;

    const wasLegacy = isLegacyAutoValidated(user);
    const updateData = {
      accountStatus: nextStatus,
      // Human review → no longer treated as 2026 auto-validated.
      legacyAutoValidated: false,
      accountReviewedAt: changedAt,
      accountReviewedByName: reviewerName,
      accountReviewedByEmail: admin.email || null,
    };

    // Old (legacy) users who are refused may re-apply once.
    if (action === REVIEW_ACTIONS.REFUSE && wasLegacy && !user.legacyReapplyUsed) {
      updateData.legacyReapplyEligible = true;
    } else if (action !== REVIEW_ACTIONS.REFUSE) {
      updateData.legacyReapplyEligible = false;
    }

    const updated = await strapi.db
      .query('plugin::users-permissions.user')
      .update({
        where: { id: user.id },
        data: updateData,
      });

    let emailSent = false;
    const shouldEmail = action !== REVIEW_ACTIONS.REJECT_WITHOUT_NOTIFICATION;

    if (shouldEmail) {
      try {
        emailSent = Boolean(
          await sendAccountReviewDecisionEmail(strapi, {
            user: { ...updated, email: user.email },
            action,
            locale,
            note,
          })
        );
      } catch (err) {
        strapi.log.error(
          `[account-review] Failed to send ${action} email to ${user.email}: ${err.message}`
        );
      }
    }

    await writeAuditLog(strapi, {
      userId: String(user.id),
      action,
      changedAt,
      updatedByName: reviewerName,
      updatedByEmail: admin.email || null,
      previousStatus,
      nextStatus,
      note,
      emailSent,
    });

    const orderCount = await countOrdersForUser(strapi, user.id);
    const auditTrail = await strapi.db
      .query('api::account-review-audit-log.account-review-audit-log')
      .findMany({
        where: { userId: String(user.id) },
        orderBy: { changedAt: 'desc' },
        limit: 50,
      });

    ctx.body = {
      data: {
        ...pickApplicationFields(updated),
        submittedAt: user.createdAt,
        hasOrderHistory: orderCount > 0,
        orderCount,
        auditTrail,
        emailSent,
      },
    };
  },

  /**
   * POST /api/account-reapply
   * Refused user re-applies with updated business details.
   * Auth: Bearer JWT (refused/more-info allowed) OR identifier+password in body
   * (password path avoids /auth/local, which blocks non-approved accounts).
   * Body: {
   *   businessName*,
   *   accommodationsCount* (number of listings),
   *   website?,
   *   airbnbProfileUrl?,
   *   reasonForPurchase?,
   *   locale?,
   *   identifier?/email?,
   *   password?
   * }
   */
  async reapply(ctx) {
    const body = ctx.request.body || {};
    let user = null;

    const authUserId = ctx.state.user?.id;
    if (authUserId) {
      user = await strapi.db
        .query('plugin::users-permissions.user')
        .findOne({ where: { id: authUserId } });
    }

    if (!user) {
      const identifier = String(
        body.identifier || body.email || ''
      ).trim();
      const password = body.password != null ? String(body.password) : '';

      if (!identifier || !password) {
        return ctx.unauthorized(
          'Authentication required. Sign in or provide email and password.'
        );
      }

      user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: {
          $or: [
            { email: { $eqi: identifier } },
            { username: { $eqi: identifier } },
          ],
        },
      });

      if (!user || user.blocked) {
        return ctx.badRequest('Invalid email or password.');
      }

      const validPassword = await strapi
        .plugin('users-permissions')
        .service('user')
        .validatePassword(password, user.password);

      if (!validPassword) {
        return ctx.badRequest('Invalid email or password.');
      }
    }

    if (!user) {
      return ctx.unauthorized();
    }

    if (!canReapplyApplication(user)) {
      if (user.legacyReapplyUsed) {
        return ctx.badRequest(
          'You have already re-applied once. Further applications are not available.',
          {
            accountStatus: getAccountStatus(user),
            legacyReapplyUsed: true,
          }
        );
      }
      return ctx.badRequest(
        'Only eligible legacy accounts can re-apply. Current status does not allow re-application.',
        { accountStatus: getAccountStatus(user) }
      );
    }

    const locale = body.locale || resolveLocaleFromContext(ctx);

    const businessName =
      body.businessName != null ? String(body.businessName).trim() : '';
    if (!businessName) {
      return ctx.badRequest('Business Name is required.');
    }

    const listingsRaw =
      body.accommodationsCount != null
        ? body.accommodationsCount
        : body.numberOfListings != null
          ? body.numberOfListings
          : body.listings;
    const accommodationsCount = parseInt(listingsRaw, 10);
    if (
      listingsRaw == null ||
      String(listingsRaw).trim() === '' ||
      !Number.isFinite(accommodationsCount) ||
      accommodationsCount < 1
    ) {
      return ctx.badRequest(
        'Number of listings is required and must be a positive integer.'
      );
    }

    const website =
      body.website != null ? String(body.website).trim() : '';
    const airbnbProfileUrl =
      body.airbnbProfileUrl != null
        ? String(body.airbnbProfileUrl).trim()
        : '';
    const reasonForPurchase =
      body.reasonForPurchase != null
        ? String(body.reasonForPurchase).trim()
        : '';

    if (airbnbProfileUrl) {
      try {
        // eslint-disable-next-line no-new
        new URL(airbnbProfileUrl);
      } catch (_) {
        return ctx.badRequest('Airbnb profile URL is invalid.');
      }
    }

    const previousStatus = getAccountStatus(user);
    const changedAt = new Date();

    const updated = await strapi.db
      .query('plugin::users-permissions.user')
      .update({
        where: { id: user.id },
        data: {
          businessName,
          accommodationsCount,
          website: website || null,
          airbnbProfileUrl: airbnbProfileUrl || null,
          reasonForPurchase: reasonForPurchase || null,
          accountStatus: ACCOUNT_STATUS.PENDING_REVIEW,
          legacyAutoValidated: false,
          legacyReapplyEligible: false,
          // One-time re-apply for legacy users — cannot re-apply again.
          legacyReapplyUsed: true,
          accountReviewedAt: null,
          accountReviewedByName: null,
          accountReviewedByEmail: null,
        },
      });

    let emailSent = false;
    try {
      await sendRegistrationConfirmationEmail(strapi, {
        email: user.email,
        locale,
      });

      await sendRegistrationAdminNotifyEmail(strapi, {
        applicant: {
          id: updated.id,
          email: user.email,
          username: updated.username || user.username,
          accountStatus: ACCOUNT_STATUS.PENDING_REVIEW,
          businessName: updated.businessName,
        },
        locale: 'en',
      });
      emailSent = true;
    } catch (err) {
      strapi.log.error(
        `[account-reapply] Failed review emails for ${user.email}: ${err.message}`
      );
    }

    try {
      await writeAuditLog(strapi, {
        userId: String(user.id),
        action: 'reapply',
        changedAt,
        updatedByName:
          user.displayName ||
          [user.firstName, user.name].filter(Boolean).join(' ').trim() ||
          user.username ||
          user.email,
        updatedByEmail: user.email || null,
        previousStatus,
        nextStatus: ACCOUNT_STATUS.PENDING_REVIEW,
        note: reasonForPurchase || null,
        emailSent,
      });
    } catch (err) {
      strapi.log.warn(
        `[account-reapply] Failed audit log for user ${user.id}: ${err.message}`
      );
    }

    ctx.body = {
      data: {
        ...pickApplicationFields(updated),
        emailSent,
      },
    };
  },
};
