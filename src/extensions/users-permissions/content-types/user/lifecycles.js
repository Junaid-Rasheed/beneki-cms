'use strict';

/**
 * Force pending_review on every user create.
 * Do not set a DB default so existing users without accountStatus stay usable
 * (frontend treats null/empty as approved).
 * Also force autoprint=true so new accounts get labels auto-printed.
 */
module.exports = {
  beforeCreate(event) {
    const { data } = event.params;
    if (data) {
      data.accountStatus = 'pending_review';
      data.autoprint = true;
    }
  },
};
