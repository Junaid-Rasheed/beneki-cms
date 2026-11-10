"use strict";

/**
 * Custom shipment-tracking routes
 */

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/shipment-trackings/:documentId/reprint",
      handler: "shipment-tracking.reprint",
    },
    {
      method: "POST",
      path: "/shipment-trackings/:documentId/regenerate",
      handler: "shipment-tracking.regenerate",
    },
  ],
};
