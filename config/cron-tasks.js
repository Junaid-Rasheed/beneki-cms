"use strict";

const { syncDpdTrackingStatuses } = require("../src/helpers/dpdTrackingSync");

/**
 * Strapi cron tasks (node-schedule).
 * DPD tracking sync: every 15 minutes, Mon–Fri, 06:00–20:00 Europe/Paris.
 */
module.exports = {
  dpdTrackingSync: {
    task: async ({ strapi }) => {
      const parisNow = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
      );
      const hour = parisNow.getHours();
      const minute = parisNow.getMinutes();
      console.log("job started");
      // Allow 06:00 inclusive through 20:00 inclusive only
      if (hour < 6 || hour > 20 || (hour === 20 && minute > 0)) {
        return;
      }

      try {
        await syncDpdTrackingStatuses({ strapi });
      } catch (err) {
        strapi.log.error(`[DPD Tracking Sync] Job failed: ${err.message}`);
      }
    },
    options: {
      rule: "0 */5 6-20 * * 1-5",
      tz: "Europe/Paris",
    },
  },
};
