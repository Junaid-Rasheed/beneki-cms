'use strict';

const {
  isHandedToDpdOrBeyond,
  collectAllBoxTrackings,
  unwrapRelationList,
  unwrapEntity,
} = require('./dpdTrackingSync');
const {
  parseCutoff,
  normalizeWorkingDays,
  computeFranceDeliveryForecast,
  calendarDaysBetween,
  isPastExpectedDelivery,
  toParisDateKey,
} = require('../utils/franceDeliveryForecast');

const EXCLUDED_STATUSES = ['cancelled', 'refund'];

function getDpdHandledDate(order) {
  return order?.dpdHandledDate || order?.attributes?.dpdHandledDate || null;
}

function unwrapAddress(order) {
  const shipping = order.shippingAddress || order.attributes?.shippingAddress;
  if (!shipping) return {};
  if (shipping.attributes) {
    return { id: shipping.id, documentId: shipping.documentId, ...shipping.attributes };
  }
  return shipping;
}

function unwrapUser(order) {
  const user = order.user || order.attributes?.user;
  if (!user) return null;
  if (user.attributes) {
    return { id: user.id, documentId: user.documentId, ...user.attributes };
  }
  return user;
}

async function loadFranceDeliveryConfig(strapi) {
  const [settings, holidays] = await Promise.all([
    strapi.db.query('api::setting.setting').findMany({
      where: {
        country: 'France',
        publishedAt: { $notNull: true },
      },
      limit: 1,
    }),
    strapi.db.query('api::holiday-setting.holiday-setting').findMany({
      where: {
        country: 'France',
        publishedAt: { $notNull: true },
      },
      limit: 500,
    }),
  ]);

  const setting = settings?.[0] || {};
  const holidaySet = new Set(
    (holidays || [])
      .map((h) => {
        if (!h?.date) return null;
        if (typeof h.date === 'string') return h.date.slice(0, 10);
        try {
          return toParisDateKey(new Date(h.date));
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );

  return {
    cutoff: parseCutoff(setting.cutoffTime),
    workingDaysSet: normalizeWorkingDays(setting.workingDays),
    holidaySet,
  };
}

function normalizeBoxStatus(status) {
  if (status == null) return null;
  const value = String(status).trim();
  return value === '' ? null : value;
}

function trackingKey(tracking) {
  return tracking?.documentId || tracking?.id || null;
}

function orderLevelTrackingKeys(order) {
  return new Set(
    unwrapRelationList(order.shipment_trackings)
      .map((raw) => trackingKey(unwrapEntity(raw)))
      .filter(Boolean)
  );
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

function summarizeBoxes(order) {
  const trackings = collectOrderItemBoxTrackings(order);
  const boxes = trackings.map((t) => {
    const status = normalizeBoxStatus(t.status);
    const handedToDpd = isHandedToDpdOrBeyond(status);
    return {
      documentId: t.documentId,
      id: t.id,
      barCodeId: t.barCodeId || null,
      barCode: t.barCode || null,
      status,
      handedToDpd,
    };
  });

  const handedToDpd = boxes.filter((b) => b.handedToDpd).length;
  const delivered = boxes.filter((b) => b.status === 'delivered').length;
  const total = boxes.length;

  return {
    boxes,
    boxSummary: {
      total,
      handedToDpd,
      delivered,
      missing: Math.max(0, total - handedToDpd),
    },
  };
}

function allBoxesHandedToDpd(summary) {
  return summary.boxSummary.total > 0 && summary.boxSummary.missing === 0;
}

function isFullyDelivered(summary) {
  const { total, delivered } = summary.boxSummary;
  return total > 0 && delivered === total;
}

/**
 * Delayed: every box is with DPD, but the customer still has not received
 * the order after the France delivery forecast (from handover, not order date).
 */
function isDelayedOrder(summary) {
  return allBoxesHandedToDpd(summary) && !isFullyDelivered(summary);
}

/**
 * Missing: some boxes handed / delivered, others still preparing or never scanned.
 */
function isMissingBoxesOrder(summary) {
  return summary.boxSummary.handedToDpd > 0 && summary.boxSummary.missing > 0;
}

function mapExceptionOrder(order, { forecast = null, now = new Date() } = {}) {
  const shipping = unwrapAddress(order);
  const user = unwrapUser(order);
  const { boxes, boxSummary } = summarizeBoxes(order);
  const handledDate = getDpdHandledDate(order);
  const todayKey = toParisDateKey(now);
  const daysOverdue = forecast
    ? Math.max(0, calendarDaysBetween(forecast.deliveryDateMax, todayKey))
    : 0;

  return {
    id: order.id,
    documentId: order.documentId,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    orderCreatedDate: order.orderCreatedDate || order.createdAt,
    createdAt: order.createdAt,
    isDpdLabelPrinted: order.isDpdLabelPrinted,
    dpdHandledDate: handledDate,
    customer: {
      id: user?.id || null,
      email: user?.email || shipping.email || null,
      firstName: user?.firstName || shipping.firstName || null,
      lastName: user?.name || user?.lastName || shipping.lastName || null,
      businessName: user?.businessName || shipping.companyName || null,
    },
    shippingAddress: {
      firstName: shipping.firstName || null,
      lastName: shipping.lastName || null,
      companyName: shipping.companyName || null,
      street: shipping.street || null,
      postalCode: shipping.postalCode || null,
      city: shipping.city || null,
      country: shipping.country || null,
      phoneNumber: shipping.phoneNumber || null,
    },
    expectedDelivery: forecast
      ? {
          range: forecast.range,
          shipStartDate: forecast.shipStartDate,
          deliveryDateMin: forecast.deliveryDateMin,
          deliveryDateMax: forecast.deliveryDateMax,
        }
      : null,
    daysOverdue,
    boxSummary,
    boxes,
    trackings: boxes,
  };
}

function buildSearchFilters(searchTerm) {
  if (!searchTerm) return {};
  return {
    $or: [
      { orderNumber: { $containsi: searchTerm } },
      { user: { email: { $containsi: searchTerm } } },
      { user: { businessName: { $containsi: searchTerm } } },
      { shippingAddress: { postalCode: { $containsi: searchTerm } } },
      { shippingAddress: { city: { $containsi: searchTerm } } },
      {
        orderItems: {
          shipment_trackings: { barCodeId: { $containsi: searchTerm } },
        },
      },
    ],
  };
}

function mergeEntities(a, b) {
  const merged = { ...(a || {}) };
  for (const [key, value] of Object.entries(b || {})) {
    if (value === null || value === undefined || value === '') {
      if (merged[key] == null || merged[key] === '') merged[key] = value;
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function mergeByKey(listA, listB) {
  const byId = new Map();
  for (const raw of [...unwrapRelationList(listA), ...unwrapRelationList(listB)]) {
    const item = unwrapEntity(raw);
    const key = item?.documentId || item?.id;
    if (!key) continue;
    const prev = byId.get(key);
    byId.set(key, prev ? mergeEntities(prev, item) : item);
  }
  return [...byId.values()];
}

function mergeLocaleOrderRows(rawOrders) {
  const byDoc = new Map();

  for (const order of rawOrders || []) {
    const key = order.documentId || order.id;
    const existing = byDoc.get(key);
    const itemIds = unwrapRelationList(order.orderItems)
      .map((item) => unwrapEntity(item)?.id)
      .filter(Boolean);

    if (!existing) {
      byDoc.set(key, {
        ...order,
        shipment_trackings: unwrapRelationList(order.shipment_trackings).map(
          unwrapEntity
        ),
        orderItems: unwrapRelationList(order.orderItems).map((item) => ({
          ...unwrapEntity(item),
          shipment_trackings: [],
        })),
        _itemIds: itemIds,
      });
      continue;
    }

    existing._itemIds = [...new Set([...(existing._itemIds || []), ...itemIds])];

    existing.shipment_trackings = mergeByKey(
      existing.shipment_trackings,
      order.shipment_trackings
    );

    existing.orderItems = mergeByKey(existing.orderItems, order.orderItems).map(
      (item) => ({
        ...item,
        shipment_trackings: [],
      })
    );

    if (!existing.dpdHandledDate && order.dpdHandledDate) {
      existing.dpdHandledDate = order.dpdHandledDate;
    }
    if (!existing.isDpdLabelPrinted && order.isDpdLabelPrinted) {
      existing.isDpdLabelPrinted = order.isDpdLabelPrinted;
    }
    if (!existing.shippingAddress && order.shippingAddress) {
      existing.shippingAddress = order.shippingAddress;
    }
    if (!existing.user && order.user) {
      existing.user = order.user;
    }
  }

  return [...byDoc.values()];
}

async function attachItemTrackings(strapi, orders) {
  const itemIds = [
    ...new Set(
      orders.flatMap((order) => [
        ...(order._itemIds || []),
        ...unwrapRelationList(order.orderItems)
          .map((item) => item?.id)
          .filter(Boolean),
      ])
    ),
  ];
  if (!itemIds.length) return orders;

  const items = await strapi.db.query('api::order-item.order-item').findMany({
    where: { id: { $in: itemIds } },
    populate: { shipment_trackings: true },
    limit: itemIds.length,
  });
  const itemsById = new Map((items || []).map((item) => [item.id, item]));

  for (const order of orders) {
    const orderItemIds = [
      ...new Set([
        ...(order._itemIds || []),
        ...unwrapRelationList(order.orderItems)
          .map((item) => item?.id)
          .filter(Boolean),
      ]),
    ];

    const trackingsByItemDoc = new Map();
    for (const itemId of orderItemIds) {
      const full = itemsById.get(itemId);
      if (!full) continue;
      const merged = mergeByKey(
        trackingsByItemDoc.get(full.documentId || full.id),
        full.shipment_trackings
      );
      if (full.documentId) trackingsByItemDoc.set(full.documentId, merged);
      if (full.id) trackingsByItemDoc.set(full.id, merged);
    }

    order.orderItems = unwrapRelationList(order.orderItems).map((item) => ({
      ...item,
      shipment_trackings:
        trackingsByItemDoc.get(item.documentId || item.id) ||
        trackingsByItemDoc.get(item.id) ||
        [],
    }));
    delete order._itemIds;
  }

  return orders;
}

async function loadFranceDpdOrders(strapi, { search = '' } = {}) {
  const searchTerm = String(search || '').trim();
  const filters = {
    isDpdLabelPrinted: true,
    orderStatus: { $notIn: EXCLUDED_STATUSES },
    shippingAddress: {
      country: { $eq: 'France' },
    },
    ...buildSearchFilters(searchTerm),
  };

  const rawOrders = await strapi.db.query('api::order.order').findMany({
    where: filters,
    populate: {
      shippingAddress: true,
      user: true,
      shipment_trackings: true,
      orderItems: {
        populate: {
          shipment_trackings: true,
        },
      },
    },
    orderBy: { orderCreatedDate: 'desc' },
    limit: 2000,
  });

  const orders = mergeLocaleOrderRows(rawOrders);
  return attachItemTrackings(strapi, orders);
}

function paginate(rows, page, pageSize) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
  const total = rows.length;
  const start = (pageNum - 1) * size;
  return {
    data: rows.slice(start, start + size),
    meta: {
      pagination: {
        page: pageNum,
        pageSize: size,
        pageCount: Math.max(1, Math.ceil(total / size)),
        total,
      },
    },
  };
}

async function findDelayedDpdOrders(strapi, { page = 1, pageSize = 25, search = '' } = {}) {
  const now = new Date();
  const config = await loadFranceDeliveryConfig(strapi);
  const orders = await loadFranceDpdOrders(strapi, { search });
  const delayed = [];

  for (const order of orders) {
    const summary = summarizeBoxes(order);
    if (!isDelayedOrder(summary)) continue;

    const shipping = unwrapAddress(order);
    const postalCode = shipping.postalCode || '';
    const anchor = getDpdHandledDate(order);
    if (!anchor) continue;

    const forecast = computeFranceDeliveryForecast(anchor, postalCode, {
      ...config,
      alreadyWithCarrier: true,
    });
    if (!forecast) continue;
    if (!isPastExpectedDelivery(forecast.deliveryDateMax, now)) continue;

    delayed.push(mapExceptionOrder(order, { forecast, now }));
  }

  delayed.sort((a, b) => {
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return (
      new Date(a.dpdHandledDate || a.orderCreatedDate).getTime() -
      new Date(b.dpdHandledDate || b.orderCreatedDate).getTime()
    );
  });

  return paginate(delayed, page, pageSize);
}

async function findMissingDpdOrders(strapi, { page = 1, pageSize = 25, search = '' } = {}) {
  const now = new Date();
  const orders = await loadFranceDpdOrders(strapi, { search });
  const missing = [];

  for (const order of orders) {
    const summary = summarizeBoxes(order);
    if (!isMissingBoxesOrder(summary)) continue;
    missing.push(mapExceptionOrder(order, { now }));
  }

  missing.sort((a, b) => {
    const missingDelta = (b.boxSummary?.missing || 0) - (a.boxSummary?.missing || 0);
    if (missingDelta !== 0) return missingDelta;
    return (
      new Date(b.dpdHandledDate || b.orderCreatedDate).getTime() -
      new Date(a.dpdHandledDate || a.orderCreatedDate).getTime()
    );
  });

  return paginate(missing, page, pageSize);
}

module.exports = {
  EXCLUDED_STATUSES,
  loadFranceDeliveryConfig,
  summarizeBoxes,
  isDelayedOrder,
  isMissingBoxesOrder,
  findDelayedDpdOrders,
  findMissingDpdOrders,
};
