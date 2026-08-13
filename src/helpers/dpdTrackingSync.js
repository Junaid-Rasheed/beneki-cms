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

/**
 * Unique shipment trackings attached to order items (per-box barcodes).
 */
function collectItemTrackings(order) {
  const byId = new Map();

  for (const item of order.orderItems || []) {
    for (const tracking of item.shipment_trackings || []) {
      if (!tracking?.barCodeId || !tracking.documentId) continue;
      byId.set(tracking.documentId, tracking);
    }
  }

  return [...byId.values()];
}

/**
 * Least-advanced status across all boxes (lowest STATUS_RANK).
 * e.g. 10 delivered + 1 in transit → "In transit"
 */
function leastStatus(statuses) {
  let least = null;
  let leastRank = Infinity;

  for (const status of statuses) {
    if (!status) continue;
    const rank = STATUS_RANK[status];
    if (rank == null) continue;
    if (rank < leastRank) {
      leastRank = rank;
      least = status;
    }
  }

  return least;
}

/**
 * Sync DPD parcel statuses for in-flight orders (Mon–Fri 06:00–20:00 Europe/Paris).
 * Tracks every order-item box; order status follows the least-advanced box.
 */
async function syncDpdTrackingStatuses({ strapi }) {
  const orders = await strapi.documents("api::order.order").findMany({
    filters: {
      orderStatus: { $in: TRACKED_ORDER_STATUSES },
      isDpdLabelPrinted: true,
      orderItems: {
        shipment_trackings: { barCodeId: { $notNull: true } },
      },
      shippingAddress: {
        country: {
          $eq: "France",
        },
      },
    },
    populate: {
      orderItems: {
        populate: {
          shipment_trackings: true,
        },
      },
    },
    limit: 200,
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    const trackings = collectItemTrackings(order);

    if (!trackings.length) {
      skipped += 1;
      continue;
    }

    try {
      const boxStatuses = [];

      for (const tracking of trackings) {
        let status = tracking.status || null;

        try {
          const trace = await dpdService.getParcelTrace(tracking.barCodeId);

          if (
            trace?.orderStatus &&
            shouldAdvanceStatus(tracking.status, trace.orderStatus)
          ) {
            await strapi
              .documents("api::shipment-tracking.shipment-tracking")
              .update({
                documentId: tracking.documentId,
                data: { status: trace.orderStatus },
              });
            status = trace.orderStatus;
            strapi.log.info(
              `[DPD Tracking Sync] Box ${tracking.barCodeId} (order ${order.orderNumber}): ${tracking.status || "n/a"} → ${trace.orderStatus}`,
            );
          } else if (trace?.orderStatus) {
            status = tracking.status || trace.orderStatus;
          }
        } catch (err) {
          strapi.log.error(
            `[DPD Tracking Sync] Failed box ${tracking.barCodeId} on order ${order.orderNumber}: ${err.message}`,
          );
        }

        // Unknown / not yet scanned → treat as preparing so order cannot outrun lagging boxes
        boxStatuses.push(status || "preparing");
      }

      const nextOrderStatus = leastStatus(boxStatuses);

      if (
        !nextOrderStatus ||
        !shouldAdvanceStatus(order.orderStatus, nextOrderStatus)
      ) {
        skipped += 1;
        continue;
      }

      await strapi.db.query("api::order.order").update({
        where: { documentId: order.documentId },
        data: { orderStatus: nextOrderStatus },
      });

      updated += 1;
      strapi.log.info(
        `[DPD Tracking Sync] Order ${order.orderNumber}: ${order.orderStatus} → ${nextOrderStatus} (least of ${trackings.length} boxes: ${boxStatuses.join(", ")})`,
      );
    } catch (err) {
      failed += 1;
      strapi.log.error(
        `[DPD Tracking Sync] Failed for order ${order.orderNumber}: ${err.message}`,
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
  STATUS_RANK,
  leastStatus,
  collectItemTrackings,
  syncDpdTrackingStatuses,
};
