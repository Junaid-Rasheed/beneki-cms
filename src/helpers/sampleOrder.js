"use strict";

const SAMPLE_PRODUCT_ID = "SMP";
const LEGACY_SAMPLE_REQUEST_NOTE = "free sample request";

function isSampleProductId(productId) {
  return String(productId ?? "").trim().toUpperCase() === SAMPLE_PRODUCT_ID;
}

function unwrapRecord(record) {
  if (!record || typeof record !== "object") return null;
  if (record.attributes && typeof record.attributes === "object") {
    return {
      id: record.id,
      documentId: record.documentId,
      ...record.attributes,
    };
  }
  return record;
}

function collectOrderItems(order) {
  const source = unwrapRecord(order) || {};
  const raw = source.orderItems?.data ?? source.orderItems ?? [];
  return (Array.isArray(raw) ? raw : []).map(unwrapRecord).filter(Boolean);
}

function orderItemsIncludeSampleProduct(orderItems) {
  return (orderItems || []).some((item) =>
    isSampleProductId(unwrapRecord(item)?.productId),
  );
}

/**
 * Sample order = SMP product on the order, or the stored isSampleOrder flag.
 * Legacy requests (no items, note "Free sample request") stay samples.
 * A zero total alone is not a sample.
 */
function isSampleOrder(order) {
  const source = unwrapRecord(order) || {};
  if (source.isSampleOrder === true) return true;
  const items = collectOrderItems(order);
  if (orderItemsIncludeSampleProduct(items)) return true;
  const notes = String(source.notes || "").trim().toLowerCase();
  return notes === LEGACY_SAMPLE_REQUEST_NOTE && items.length === 0;
}

/**
 * Persist isSampleOrder from the order's line items.
 * True only when an item productId is SMP.
 */
async function syncSampleOrderFlag(strapi, entity) {
  if (!entity) return entity;
  const documentId = entity.documentId;
  const id = entity.id;
  if (!documentId && id == null) return entity;

  const where = documentId ? { documentId } : { id };
  const order = await strapi.db.query("api::order.order").findOne({
    where,
    populate: ["orderItems"],
  });
  if (!order) return entity;

  const isSample = orderItemsIncludeSampleProduct(order.orderItems);
  const stored = order.isSampleOrder === true;
  if (stored === isSample) {
    return { ...entity, isSampleOrder: stored };
  }

  await strapi.db.query("api::order.order").update({
    where: { id: order.id },
    data: { isSampleOrder: isSample },
  });

  return { ...entity, isSampleOrder: isSample };
}

module.exports = {
  SAMPLE_PRODUCT_ID,
  isSampleProductId,
  orderItemsIncludeSampleProduct,
  isSampleOrder,
  syncSampleOrderFlag,
};
