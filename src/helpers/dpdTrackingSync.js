"use strict";

const dpdService = require("../api/dpd/services/dpd");

const TRACKED_ORDER_STATUSES = [
  "preparing",
  "Parcel handed to DPD",
  "In transit",
  "At delivery centre",
  "Parcel out for delivery",
];

const STATUS_RANK = {
  preparing: 0,
  shipped: 0,
  "Parcel handed to DPD": 1,
  "In transit": 2,
  "At delivery centre": 3,
  "Parcel out for delivery": 4,
  delivered: 5,
};

function shouldAdvanceStatus(currentStatus, nextStatus) {
  if (!nextStatus || currentStatus === nextStatus) return false;
  const currentRank = STATUS_RANK[currentStatus];
  const nextRank = STATUS_RANK[nextStatus];
  if (currentRank == null || nextRank == null) return true;
  return nextRank >= currentRank;
}

function pickTrackingNumber(order) {
  const trackings = order.shipment_trackings || [];
  const withBarcode = trackings.find((t) => t.barCodeId);
  return withBarcode?.barCodeId || null;
}

/**
 * Sync DPD parcel statuses for in-flight orders (Mon–Fri 06:00–20:00 Europe/Paris).
 */
async function syncDpdTrackingStatuses({ strapi }) {
  const orders = await strapi.documents("api::order.order").findMany({
    filters: {
      orderStatus: { $in: TRACKED_ORDER_STATUSES },
      isDpdLabelPrinted: true,
      shipment_trackings: { barCodeId: { $notNull: true } },
      shippingAddress: {
        country: {
          $eq: "France",
        },
      },
    },
    populate: {
      shipment_trackings: true,
    },
    limit: 200,
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    const shipmentNumber = pickTrackingNumber(order);

    if (!shipmentNumber) {
      skipped += 1;
      continue;
    }

    try {
      const trace = await dpdService.getParcelTrace(shipmentNumber);

      if (!trace?.orderStatus) {
        skipped += 1;
        continue;
      }

      if (!shouldAdvanceStatus(order.orderStatus, trace.orderStatus)) {
        skipped += 1;
        continue;
      }

      await strapi.db.query("api::order.order").update({
        where: { documentId: order.documentId },
        data: { orderStatus: trace.orderStatus },
      });

      updated += 1;
      strapi.log.info(
        `[DPD Tracking Sync] Order ${order.orderNumber}: ${order.orderStatus} → ${trace.orderStatus} (${trace.statusNumber}: ${trace.statusDescription})`,
      );
    } catch (err) {
      failed += 1;
      strapi.log.error(
        `[DPD Tracking Sync] Failed for order ${order.orderNumber} / ${shipmentNumber}: ${err.message}`,
      );
    }
  }

  strapi.log.info(
    `[DPD Tracking Sync] Done. checked=${orders.length} updated=${updated} skipped=${skipped} failed=${failed}`,
  );

  return { checked: orders.length, updated, skipped, failed };
}

module.exports = {
  TRACKED_ORDER_STATUSES,
  syncDpdTrackingStatuses,
};
