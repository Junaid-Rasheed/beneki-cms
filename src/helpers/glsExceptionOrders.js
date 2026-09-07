'use strict';

const {
  isHandedToGlsOrBeyond,
  collectOrderItemBoxTrackings,
  unwrapRelationList,
  unwrapEntity,
} = require('./dpdTrackingSync');
const {
  parseCutoff,
  normalizeWorkingDays,
  computeDeliveryForecast,
  calendarDaysBetween,
  isPastExpectedDelivery,
  toParisDateKey,
} = require('../utils/franceDeliveryForecast');

const EXCLUDED_STATUSES = ['cancelled', 'refund'];

/** Same ranges as storefront Cart / Checkout / ProductDetail. */
const BASE_DELIVERY_RANGES = [
  { country: 'Belgium', range: '1–2 days' },
  { country: 'Germany', range: '2 days' },
  { country: 'Austria', range: '3 days' },
  { country: 'Italy', range: '2–4 days' },
  { country: 'Netherlands', range: '2 days' },
  { country: 'Spain', range: '2–3 days' },
  { country: 'Poland', range: '4 days' },
  { country: 'Denmark', range: '3 days' },
  { country: 'Portugal', range: '2–3 days' },
  { country: 'Hungary', range: '4 days' },
  { country: 'Luxembourg', range: '1–2 days' },
  { country: 'Slovakia', range: '2 days' },
  { country: 'Czech Republic', range: '3 days' },
];

/** Settings enum uses "Italia"; addresses/storefront use "Italy". */
function settingsCountryKey(country) {
  const value = String(country || '').trim();
  if (/^ital/i.test(value)) return 'Italia';
  return value;
}

function rangeCountryKey(country) {
  const value = String(country || '').trim();
  if (/^ital/i.test(value)) return 'Italy';
  return value;
}

function getBaseRangeForCountry(countryName) {
  const key = rangeCountryKey(countryName).toLowerCase();
  const match = BASE_DELIVERY_RANGES.find(
    (entry) => entry.country.toLowerCase() === key
  );
  return match?.range || '2–4 days';
}

function getGlsHandledDate(order) {
  return (
    order?.dpdHandledDate ||
    order?.attributes?.dpdHandledDate ||
    order?.orderCreatedDate ||
    order?.createdAt ||
    null
  );
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

function holidayDateKey(h) {
  if (!h?.date) return null;
  if (typeof h.date === 'string') return h.date.slice(0, 10);
  try {
    return toParisDateKey(new Date(h.date));
  } catch {
    return null;
  }
}

async function loadCountryDeliveryConfig(strapi, country) {
  const settingsCountry = settingsCountryKey(country);
  const isFrance = String(country || '').toLowerCase() === 'france';

  const [settings, countryHolidays, franceHolidays] = await Promise.all([
    strapi.db.query('api::setting.setting').findMany({
      where: {
        country: settingsCountry,
        publishedAt: { $notNull: true },
      },
      limit: 1,
    }),
    strapi.db.query('api::holiday-setting.holiday-setting').findMany({
      where: {
        country: settingsCountry,
        publishedAt: { $notNull: true },
      },
      limit: 500,
    }),
    isFrance
      ? Promise.resolve([])
      : strapi.db.query('api::holiday-setting.holiday-setting').findMany({
          where: {
            country: 'France',
            publishedAt: { $notNull: true },
          },
          limit: 500,
        }),
  ]);

  const setting = settings?.[0] || {};
  const holidaySet = new Set(
    [...(countryHolidays || []), ...(franceHolidays || [])]
      .map(holidayDateKey)
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

function summarizeBoxes(order) {
  const trackings = collectOrderItemBoxTrackings(order);
  const boxes = trackings.map((t) => {
    const status = normalizeBoxStatus(t.status);
    const handedToGls = isHandedToGlsOrBeyond(status);
    return {
      documentId: t.documentId,
      id: t.id,
      barCodeId: t.barCodeId || null,
      barCode: t.barCode || null,
      status,
      handedToGls,
      handedToDpd: handedToGls,
    };
  });

  const handedToGls = boxes.filter((b) => b.handedToGls).length;
  const delivered = boxes.filter((b) => b.status === 'delivered').length;
  const total = boxes.length;

  return {
    boxes,
    boxSummary: {
      total,
      handedToGls,
      handedToDpd: handedToGls,
      delivered,
      missing: Math.max(0, total - handedToGls),
    },
  };
}

function allBoxesHandedToGls(summary) {
  return summary.boxSummary.total > 0 && summary.boxSummary.missing === 0;
}

function isFullyDelivered(summary) {
  const { total, delivered } = summary.boxSummary;
  return total > 0 && delivered === total;
}

function isDelayedOrder(summary) {
  return allBoxesHandedToGls(summary) && !isFullyDelivered(summary);
}

function isMissingBoxesOrder(summary) {
  return summary.boxSummary.handedToGls > 0 && summary.boxSummary.missing > 0;
}

function mapExceptionOrder(order, { forecast = null, now = new Date() } = {}) {
  const shipping = unwrapAddress(order);
  const user = unwrapUser(order);
  const { boxes, boxSummary } = summarizeBoxes(order);
  const handledDate = getGlsHandledDate(order);
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
    glsHandledDate: handledDate,
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
      { shippingAddress: { country: { $containsi: searchTerm } } },
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

async function loadGlsOrders(strapi, { search = '' } = {}) {
  const searchTerm = String(search || '').trim();
  const filters = {
    isDpdLabelPrinted: true,
    orderStatus: { $notIn: EXCLUDED_STATUSES },
    shippingAddress: {
      country: { $ne: 'France' },
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

async function findDelayedGlsOrders(strapi, { page = 1, pageSize = 25, search = '' } = {}) {
  const now = new Date();
  const orders = await loadGlsOrders(strapi, { search });
  const delayed = [];
  const configCache = new Map();

  for (const order of orders) {
    const summary = summarizeBoxes(order);
    if (!isDelayedOrder(summary)) continue;

    const shipping = unwrapAddress(order);
    const country = shipping.country || '';
    const anchor = getGlsHandledDate(order);
    if (!anchor) continue;

    let config = configCache.get(country);
    if (!config) {
      config = await loadCountryDeliveryConfig(strapi, country);
      configCache.set(country, config);
    }

    const forecast = computeDeliveryForecast(
      anchor,
      getBaseRangeForCountry(country),
      {
        ...config,
        alreadyWithCarrier: true,
      }
    );
    if (!forecast) continue;
    if (!isPastExpectedDelivery(forecast.deliveryDateMax, now)) continue;

    delayed.push(mapExceptionOrder(order, { forecast, now }));
  }

  delayed.sort((a, b) => {
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return (
      new Date(a.glsHandledDate || a.orderCreatedDate).getTime() -
      new Date(b.glsHandledDate || b.orderCreatedDate).getTime()
    );
  });

  return paginate(delayed, page, pageSize);
}

async function findMissingGlsOrders(strapi, { page = 1, pageSize = 25, search = '' } = {}) {
  const now = new Date();
  const orders = await loadGlsOrders(strapi, { search });
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
      new Date(b.glsHandledDate || b.orderCreatedDate).getTime() -
      new Date(a.glsHandledDate || a.orderCreatedDate).getTime()
    );
  });

  return paginate(missing, page, pageSize);
}

module.exports = {
  EXCLUDED_STATUSES,
  summarizeBoxes,
  isDelayedOrder,
  isMissingBoxesOrder,
  findDelayedGlsOrders,
  findMissingGlsOrders,
};
