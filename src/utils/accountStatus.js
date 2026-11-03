'use strict';

const ACCOUNT_STATUS = {
  PENDING_REVIEW: 'pending_review',
  MORE_INFO_REQUESTED: 'more_info_requested',
  REFUSED: 'refused',
  REJECTED_WITHOUT_NOTIFICATION: 'rejected_without_notification',
  APPROVED: 'approved',
  SUSPENDED: 'suspended',
};

const NON_APPROVED = new Set([
  ACCOUNT_STATUS.PENDING_REVIEW,
  ACCOUNT_STATUS.REFUSED,
  ACCOUNT_STATUS.REJECTED_WITHOUT_NOTIFICATION,
  ACCOUNT_STATUS.SUSPENDED,
]);

/**
 * Statuses that may authenticate only to complete a resubmission / re-apply
 * (shop access still requires approved via isAccountApproved).
 */
const RESUBMIT_ALLOWED = new Set([
  ACCOUNT_STATUS.MORE_INFO_REQUESTED,
  ACCOUNT_STATUS.REFUSED,
]);

const REVIEW_ACTIONS = {
  APPROVE: 'approve',
  REQUEST_MORE_INFO: 'request_more_info',
  REFUSE: 'refuse',
  REJECT_WITHOUT_NOTIFICATION: 'reject_without_notification',
  SUSPEND: 'suspend',
};

const ACTION_TO_STATUS = {
  [REVIEW_ACTIONS.APPROVE]: ACCOUNT_STATUS.APPROVED,
  [REVIEW_ACTIONS.REQUEST_MORE_INFO]: ACCOUNT_STATUS.MORE_INFO_REQUESTED,
  [REVIEW_ACTIONS.REFUSE]: ACCOUNT_STATUS.REFUSED,
  [REVIEW_ACTIONS.REJECT_WITHOUT_NOTIFICATION]:
    ACCOUNT_STATUS.REJECTED_WITHOUT_NOTIFICATION,
  [REVIEW_ACTIONS.SUSPEND]: ACCOUNT_STATUS.SUSPENDED,
};

/**
 * Missing/empty accountStatus → approved (legacy accounts keep shop access).
 */
function getAccountStatus(user) {
  const raw = user?.accountStatus;
  if (raw == null || String(raw).trim() === '') {
    return ACCOUNT_STATUS.APPROVED;
  }
  return String(raw).trim().toLowerCase().replace(/\s+/g, '_');
}

/** Inactivity suspension. `isSuspended` is the flag the re-apply check uses. */
function isAccountSuspended(user) {
  return (
    Boolean(user?.isSuspended) ||
    getAccountStatus(user) === ACCOUNT_STATUS.SUSPENDED
  );
}

function isAccountApproved(user) {
  if (isAccountSuspended(user)) return false;
  return getAccountStatus(user) === ACCOUNT_STATUS.APPROVED;
}

function canResubmitApplication(user) {
  return getAccountStatus(user) === ACCOUNT_STATUS.MORE_INFO_REQUESTED;
}

function isLegacyAutoValidated(user) {
  return Boolean(user?.legacyAutoValidated);
}

/**
 * Suspended accounts may re-apply (isSuspended).
 * Legacy refused users may re-apply once.
 */
function canReapplyApplication(user) {
  if (isAccountSuspended(user)) return true;
  if (getAccountStatus(user) !== ACCOUNT_STATUS.REFUSED) return false;
  if (Boolean(user?.legacyReapplyUsed)) return false;
  return (
    Boolean(user?.legacyAutoValidated) || Boolean(user?.legacyReapplyEligible)
  );
}

function isAccountBlockedFromAuth(user) {
  // No shop JWT. Login error includes canReapply so they can apply again.
  if (isAccountSuspended(user)) return true;

  const status = getAccountStatus(user);
  if (status === ACCOUNT_STATUS.MORE_INFO_REQUESTED) return false;
  // Refused JWT only for legacy users who still have a one-time re-apply left.
  if (status === ACCOUNT_STATUS.REFUSED && canReapplyApplication(user)) {
    return false;
  }
  return NON_APPROVED.has(status);
}

module.exports = {
  ACCOUNT_STATUS,
  NON_APPROVED,
  RESUBMIT_ALLOWED,
  REVIEW_ACTIONS,
  ACTION_TO_STATUS,
  getAccountStatus,
  isAccountApproved,
  isAccountSuspended,
  isAccountBlockedFromAuth,
  canResubmitApplication,
  canReapplyApplication,
  isLegacyAutoValidated,
};
