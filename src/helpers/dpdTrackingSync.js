"use strict";

const dpdService = require("../api/dpd/services/dpd");
const glsService = require("../api/gls/services/gls");

const DPD_TRACKED_ORDER_STATUSES = [
  "preparing",
  "Parcel handed to DPD",
  "In transit",
  "At delivery centre",
  "Parcel out for delivery",
];

const GLS_TRACKED_ORDER_STATUSES = [
  "preparing",
  "Preadvice",
  "In transit",
  "Final parcel center",
  "In delivery",
  "shipped", // legacy GLS orders before status tracking
];

const DPD_STATUS_RANK = {
  preparing: 0,
  shipped: 0,
  "Parcel handed to DPD": 1,
  "In transit": 2,
  "At delivery centre": 3,
  "Parcel out for delivery": 4,
  delivered: 5,
};

const GLS_STATUS_RANK = {
  shipped: 0,
  preparing: 0,
  Preadvice: 1,
  "In transit": 2,
  "Final parcel center": 3,
  "In delivery": 4,
  delivered: 5,
};

/** @deprecated use DPD_STATUS_RANK */
const STATUS_RANK = DPD_STATUS_RANK;

const HANDED_RANK = DPD_STATUS_RANK["Parcel handed to DPD"];

function isHandedToDpdOrBeyond(status) {
  const rank = DPD_STATUS_RANK[status];
  return rank != null && rank >= HANDED_RANK;
}

function statusRankForCarrier(status, carrier) {
  const ranks = carrier === "gls" ? GLS_STATUS_RANK : DPD_STATUS_RANK;
  return ranks[status];
}

/**
 * DPD Webtrace ScanDate / ScanTime → Date (Europe/Paris wall time as local ISO).
 */
function parseDpdScanDateTime(scanDate, scanTime) {
  if (!scanDate) return null;

  let datePart = String(scanDate).trim();
  let timePart = String(scanTime || "00:00:00").trim();

  if (/^\d{8}$/.test(datePart)) {
    datePart = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(datePart)) {
    const [d, m, y] = datePart.split("/");
    datePart = `${y}-${m}-${d}`;
  } else if (datePart.includes("T")) {
    datePart = datePart.slice(0, 10);
  }

  if (/^\d{6}$/.test(timePart)) {
    timePart = `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}`;
  } else if (/^\d{4}$/.test(timePart)) {
    timePart = `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:00`;
  } else if (/^\d{2}:\d{2}$/.test(timePart)) {
    timePart = `${timePart}:00`;
  }

  const parsed = new Date(`${datePart}T${timePart}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function earlierDate(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return a.getTime() <= b.getTime() ? a : b;
}

function shouldAdvanceStatus(currentStatus, nextStatus, carrier) {
  if (!nextStatus || currentStatus === nextStatus) return false;
  const currentRank = statusRankForCarrier(currentStatus, carrier);
  const nextRank = statusRankForCarrier(nextStatus, carrier);
  if (currentRank == null || nextRank == null) return true;
  return nextRank >= currentRank;
}

/**
 * Unique shipment trackings attached to order items (per-box barcodes).
 */
function unwrapRelationList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  return [];
}

function unwrapEntity(value) {
  if (!value) return null;
  if (value.attributes) {
    return {
      id: value.id,
      documentId: value.documentId,
      ...value.attributes,
    };
  }
  return value;
}

function collectTrackingsFromOrder(
  order,
  { requireBarCodeId = true, includeOrderTrackings = true } = {},
) {
  const byId = new Map();
  const items = unwrapRelationList(order.orderItems).map(unwrapEntity);
  const lists = items.map((item) => item?.shipment_trackings);
  if (includeOrderTrackings) {
    lists.push(order.shipment_trackings);
  }

  for (const list of lists) {
    for (const raw of unwrapRelationList(list)) {
      const tracking = unwrapEntity(raw);
      const key = tracking?.documentId || tracking?.id;
      if (!tracking || !key) continue;
      if (requireBarCodeId && !tracking.barCodeId) continue;
      const prev = byId.get(key);
      byId.set(key, prev ? { ...prev, ...tracking } : tracking);
    }
  }

  return [...byId.values()];
}

function trackingKey(tracking) {
  return tracking?.documentId || tracking?.id || null;
}

function orderLevelTrackingKeys(order) {
  return new Set(
    unwrapRelationList(order.shipment_trackings)
      .map((raw) => trackingKey(unwrapEntity(raw)))
      .filter(Boolean),
  );
}

function collectItemTrackings(order) {
  return collectOrderItemBoxTrackings(order).filter((t) => t.barCodeId);
}

/** Per-box trackings on order items only (not the order-level master tracking). */
function collectAllBoxTrackings(order) {
  return collectTrackingsFromOrder(order, {
    requireBarCodeId: false,
    includeOrderTrackings: false,
  });
}

/**
 * Boxes = order-item shipment trackings only.
 * The order-level master barcode is never a box. If it leaked onto items,
 * drop it whenever the items also have their own (slave) trackings.
 */
function collectOrderItemBoxTrackings(order) {
  const itemTrackings = collectAllBoxTrackings(order);
  const orderKeys = orderLevelTrackingKeys(order);
  if (!orderKeys.size) return itemTrackings;

  const itemOnly = itemTrackings.filter((t) => !orderKeys.has(trackingKey(t)));
  if (itemOnly.length > 0) return itemOnly;

  // Single-parcel orders connect the same tracking to the order and every item.
  return itemTrackings;
}

/**
 * Least-advanced status across all boxes (lowest rank for the carrier).
 */
function leastStatus(statuses, carrier) {
  let least = null;
  let leastRank = Infinity;

  for (const status of statuses) {
    if (!status) continue;
    const rank = statusRankForCarrier(status, carrier);
    if (rank == null) continue;
    if (rank < leastRank) {
      leastRank = rank;
      least = status;
    }
  }

  return least;
}

function defaultBoxStatus(carrier) {
  return carrier === "gls" ? "Preadvice" : "preparing";
}

async function syncCarrierOrders({ strapi, orders, carrier, logPrefix }) {
  const getTrace =
    carrier === "gls"
      ? (barCodeId) => glsService.getParcelTrace(barCodeId)
      : (barCodeId) => dpdService.getParcelTrace(barCodeId);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    const trackings = collectOrderItemBoxTrackings(order);

    if (!trackings.length) {
      skipped += 1;
      continue;
    }

    try {
      const boxStatuses = [];
      let earliestHandledDate = order.dpdHandledDate
        ? new Date(order.dpdHandledDate)
        : null;
      if (earliestHandledDate && Number.isNaN(earliestHandledDate.getTime())) {
        earliestHandledDate = null;
      }

      for (const tracking of trackings) {
        let status = tracking.status || null;
        let trace = null;

        if (!tracking.barCodeId) {
          boxStatuses.push(status || defaultBoxStatus(carrier));
          continue;
        }

        try {
          trace = await getTrace(tracking.barCodeId);

          if (
            trace?.orderStatus &&
            shouldAdvanceStatus(tracking.status, trace.orderStatus, carrier)
          ) {
            await strapi
              .documents("api::shipment-tracking.shipment-tracking")
              .update({
                documentId: tracking.documentId,
                data: { status: trace.orderStatus },
              });
            status = trace.orderStatus;
            strapi.log.info(
              `${logPrefix} Box ${tracking.barCodeId} (order ${order.orderNumber}): ${tracking.status || "n/a"} → ${trace.orderStatus}`,
            );
          } else if (trace?.orderStatus) {
            status = tracking.status || trace.orderStatus;
          }
        } catch (err) {
          strapi.log.error(
            `${logPrefix} Failed box ${tracking.barCodeId} on order ${order.orderNumber}: ${err.message}`,
          );
        }

        if (carrier === "dpd" && isHandedToDpdOrBeyond(status) && !order.dpdHandledDate) {
          const fromScan = parseDpdScanDateTime(
            trace?.scanDate,
            trace?.scanTime,
          );
          earliestHandledDate = earlierDate(
            earliestHandledDate,
            fromScan || new Date(),
          );
        }

        boxStatuses.push(status || defaultBoxStatus(carrier));
      }

      const nextOrderStatus = leastStatus(boxStatuses, carrier);
      const shouldUpdateStatus =
        nextOrderStatus &&
        shouldAdvanceStatus(order.orderStatus, nextOrderStatus, carrier);
      const shouldSetHandledDate =
        carrier === "dpd" &&
        !order.dpdHandledDate &&
        Boolean(earliestHandledDate);

      if (!shouldUpdateStatus && !shouldSetHandledDate) {
        skipped += 1;
        continue;
      }

      const data = {};
      if (shouldUpdateStatus) data.orderStatus = nextOrderStatus;
      if (shouldSetHandledDate) data.dpdHandledDate = earliestHandledDate;

      await strapi.db.query("api::order.order").update({
        where: { documentId: order.documentId },
        data,
      });

      updated += 1;
      if (shouldUpdateStatus) {
        strapi.log.info(
          `${logPrefix} Order ${order.orderNumber}: ${order.orderStatus} → ${nextOrderStatus} (least of ${trackings.length} boxes: ${boxStatuses.join(", ")})`,
        );
      }
      if (shouldSetHandledDate) {
        strapi.log.info(
          `${logPrefix} Order ${order.orderNumber}: dpdHandledDate=${earliestHandledDate.toISOString()}`,
        );
      }
    } catch (err) {
      failed += 1;
      strapi.log.error(
        `${logPrefix} Failed for order ${order.orderNumber}: ${err.message}`,
      );
    }
  }

  strapi.log.info(
    `${logPrefix} Done. checked=${orders.length} updated=${updated} skipped=${skipped} failed=${failed}`,
  );

  return { checked: orders.length, updated, skipped, failed };
}

const ORDER_POPULATE = {
  shipment_trackings: true,
  orderItems: {
    populate: {
      shipment_trackings: true,
    },
  },
};

/**
 * Sync DPD parcel statuses for in-flight France orders (Mon–Fri 06:00–20:00 Europe/Paris).
 * Tracks every order-item box; order status follows the least-advanced box.
 */
async function syncDpdTrackingStatuses({ strapi }) {
  const [dpdOrders, glsOrders] = await Promise.all([
    strapi.documents("api::order.order").findMany({
      filters: {
        orderStatus: { $in: DPD_TRACKED_ORDER_STATUSES },
        isDpdLabelPrinted: true,
        orderItems: {
          shipment_trackings: { barCodeId: { $notNull: true } },
        },
        shippingAddress: {
          country: { $eq: "France" },
        },
      },
      populate: ORDER_POPULATE,
      limit: 200,
    }),
    strapi.documents("api::order.order").findMany({
      filters: {
        orderStatus: { $in: GLS_TRACKED_ORDER_STATUSES },
        isDpdLabelPrinted: true,
        orderItems: {
          shipment_trackings: { barCodeId: { $notNull: true } },
        },
        shippingAddress: {
          country: { $ne: "France" },
        },
      },
      populate: ORDER_POPULATE,
      limit: 200,
    }),
  ]);

  const dpdResult = await syncCarrierOrders({
    strapi,
    orders: dpdOrders,
    carrier: "dpd",
    logPrefix: "[DPD Tracking Sync]",
  });
  const glsResult = await syncCarrierOrders({
    strapi,
    orders: glsOrders,
    carrier: "gls",
    logPrefix: "[GLS Tracking Sync]",
  });

  return {
    checked: dpdResult.checked + glsResult.checked,
    updated: dpdResult.updated + glsResult.updated,
    skipped: dpdResult.skipped + glsResult.skipped,
    failed: dpdResult.failed + glsResult.failed,
    dpd: dpdResult,
    gls: glsResult,
  };
}

module.exports = {
  TRACKED_ORDER_STATUSES: DPD_TRACKED_ORDER_STATUSES,
  DPD_TRACKED_ORDER_STATUSES,
  GLS_TRACKED_ORDER_STATUSES,
  STATUS_RANK,
  DPD_STATUS_RANK,
  GLS_STATUS_RANK,
  HANDED_RANK,
  isHandedToDpdOrBeyond,
  parseDpdScanDateTime,
  leastStatus,
  collectItemTrackings,
  collectAllBoxTrackings,
  collectOrderItemBoxTrackings,
  unwrapRelationList,
  unwrapEntity,
  syncDpdTrackingStatuses,
};
