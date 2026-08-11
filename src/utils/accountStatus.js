'use strict';

const ACCOUNT_STATUS = {
  PENDING_REVIEW: 'pending_review',
  MORE_INFO_REQUESTED: 'more_info_requested',
  REFUSED: 'refused',
  REJECTED_WITHOUT_NOTIFICATION: 'rejected_without_notification',
  APPROVED: 'approved',
};

const NON_APPROVED = new Set([
  ACCOUNT_STATUS.PENDING_REVIEW,
  ACCOUNT_STATUS.REFUSED,
  ACCOUNT_STATUS.REJECTED_WITHOUT_NOTIFICATION,
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
};

const ACTION_TO_STATUS = {
  [REVIEW_ACTIONS.APPROVE]: ACCOUNT_STATUS.APPROVED,
  [REVIEW_ACTIONS.REQUEST_MORE_INFO]: ACCOUNT_STATUS.MORE_INFO_REQUESTED,
  [REVIEW_ACTIONS.REFUSE]: ACCOUNT_STATUS.REFUSED,
  [REVIEW_ACTIONS.REJECT_WITHOUT_NOTIFICATION]:
    ACCOUNT_STATUS.REJECTED_WITHOUT_NOTIFICATION,
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

function isAccountApproved(user) {
  return getAccountStatus(user) === ACCOUNT_STATUS.APPROVED;
}

function canResubmitApplication(user) {
  return getAccountStatus(user) === ACCOUNT_STATUS.MORE_INFO_REQUESTED;
}

function isLegacyAutoValidated(user) {
  return Boolean(user?.legacyAutoValidated);
}

/**
 * Only legacy (old) refused users may re-apply, and only once.
 * Eligibility: legacyAutoValidated OR legacyReapplyEligible, and not yet used.
 */
function canReapplyApplication(user) {
  if (getAccountStatus(user) !== ACCOUNT_STATUS.REFUSED) return false;
  if (Boolean(user?.legacyReapplyUsed)) return false;
  return (
    Boolean(user?.legacyAutoValidated) || Boolean(user?.legacyReapplyEligible)
  );
}

function isAccountBlockedFromAuth(user) {
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
  isAccountBlockedFromAuth,
  canResubmitApplication,
  canReapplyApplication,
  isLegacyAutoValidated,
};
