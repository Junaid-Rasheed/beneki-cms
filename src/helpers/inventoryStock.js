'use strict';

/**
 * Apply / restore inventory stock when an order becomes paid or refunded.
 *
 * Matching rule (strict):
 *   order-item.productId  ===  product-detail.productId
 * Then use that product-detail's linked inventory (if any).
 * No name / sidebar-id fallbacks.
 */

function parseQty(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeProductId(value) {
  if (value == null) return null;
  const id = String(value).trim();
  return id ? id : null;
}

/**
 * Resolve inventory for one order line by matching
 * order-item.productId === product-detail.productId only.
 */
async function findInventoryForOrderItem(strapi, item) {
  if (!item) return null;

  const orderProductId = normalizeProductId(item.productId);
  if (!orderProductId) {
    strapi.log.info(
      `[inventoryStock] Order item missing productId (name=${item.productName || 'n/a'}); skip`
    );
    return null;
  }

  // Exact match on product-detail.productId
  const details = await strapi.db
    .query('api::product-detail.product-detail')
    .findMany({
      where: { productId: { $eq: orderProductId } },
      populate: ['inventory'],
      limit: 100,
    });

  // Safety: also accept string equality in case DB type coercion differs
  const matched = (details || []).filter(
    (detail) => normalizeProductId(detail?.productId) === orderProductId
  );

  if (!matched.length) {
    strapi.log.info(
      `[inventoryStock] No product-detail with productId=${orderProductId}; skip`
    );
    return null;
  }

  for (const detail of matched) {
    if (detail?.inventory?.id) {
      return detail.inventory;
    }
  }

  strapi.log.info(
    `[inventoryStock] product-detail productId=${orderProductId} found but has no linked inventory; skip`
  );
  return null;
}

/**
 * Aggregate ordered quantities per inventory id for an order.
 * @returns {Promise<Map<number, number>>}
 */
async function buildInventoryDeltas(strapi, orderItems) {
  const deltas = new Map();

  for (const item of orderItems || []) {
    const qty = parseQty(item.quantity);
    if (!qty) continue;

    const inventory = await findInventoryForOrderItem(strapi, item);
    if (!inventory?.id) {
      continue;
    }

    deltas.set(
      inventory.id,
      (deltas.get(inventory.id) || 0) + qty
    );
  }

  return deltas;
}

async function loadOrderWithItems(strapi, orderRef) {
  if (!orderRef) return null;

  const where = orderRef.id
    ? { id: orderRef.id }
    : orderRef.documentId
      ? { documentId: orderRef.documentId }
      : orderRef.orderNumber
        ? { orderNumber: orderRef.orderNumber }
        : null;

  if (!where) return null;

  return strapi.db.query('api::order.order').findOne({
    where,
    populate: ['orderItems'],
  });
}

async function setInventoryStockApplied(strapi, orderId, applied) {
  await strapi.db.query('api::order.order').update({
    where: { id: orderId },
    data: { inventoryStockApplied: !!applied },
  });
}

async function adjustInventories(strapi, deltas, { restore }) {
  const inventoryService = strapi.service('api::inventory.inventory');
  const results = [];

  for (const [inventoryId, qty] of deltas.entries()) {
    const inventory = await strapi.db
      .query('api::inventory.inventory')
      .findOne({ where: { id: inventoryId } });

    if (!inventory) continue;

    const current = Number(inventory.stock) || 0;
    const next = restore
      ? current + qty
      : Math.max(0, current - qty);

    if (!restore && current < qty) {
      strapi.log.warn(
        `[inventoryStock] Inventory #${inventoryId} stock ${current} < ordered ${qty}; clamping to 0`
      );
    }

    await strapi.db.query('api::inventory.inventory').update({
      where: { id: inventoryId },
      data: { stock: next },
    });

    if (inventoryService?.syncProductDetailStockFlags) {
      await inventoryService.syncProductDetailStockFlags(inventoryId, next);
    }

    results.push({
      inventoryId,
      productName: inventory.productName,
      from: current,
      to: next,
      qty,
      restore: !!restore,
    });
  }

  return results;
}

/**
 * Deduct stock for a paid order (idempotent via inventoryStockApplied).
 */
async function applyOrderInventoryDeduction(strapi, orderRef) {
  try {
    const order = await loadOrderWithItems(strapi, orderRef);
    if (!order) {
      return { applied: false, reason: 'order_not_found' };
    }

    if (order.inventoryStockApplied) {
      return { applied: false, reason: 'already_applied', orderId: order.id };
    }

    const deltas = await buildInventoryDeltas(strapi, order.orderItems);
    if (!deltas.size) {
      // Mark applied so refunds that never deducted don't restore wrongly,
      // and so we don't keep retrying items with no inventory.
      await setInventoryStockApplied(strapi, order.id, true);
      return {
        applied: true,
        reason: 'no_inventory_rows',
        orderId: order.id,
        changes: [],
      };
    }

    const changes = await adjustInventories(strapi, deltas, { restore: false });
    await setInventoryStockApplied(strapi, order.id, true);

    strapi.log.info(
      `[inventoryStock] Deducted stock for order #${order.id} (${order.orderNumber || order.documentId}): ${JSON.stringify(changes)}`
    );

    return { applied: true, orderId: order.id, changes };
  } catch (err) {
    strapi.log.error(
      `[inventoryStock] Deduction failed: ${err.message}`
    );
    return { applied: false, reason: 'error', error: err.message };
  }
}

/**
 * Restore stock for a refunded order (idempotent via inventoryStockApplied).
 */
async function restoreOrderInventory(strapi, orderRef) {
  try {
    const order = await loadOrderWithItems(strapi, orderRef);
    if (!order) {
      return { restored: false, reason: 'order_not_found' };
    }

    if (!order.inventoryStockApplied) {
      return { restored: false, reason: 'not_applied', orderId: order.id };
    }

    const deltas = await buildInventoryDeltas(strapi, order.orderItems);
    if (!deltas.size) {
      await setInventoryStockApplied(strapi, order.id, false);
      return {
        restored: true,
        reason: 'no_inventory_rows',
        orderId: order.id,
        changes: [],
      };
    }

    const changes = await adjustInventories(strapi, deltas, { restore: true });
    await setInventoryStockApplied(strapi, order.id, false);

    strapi.log.info(
      `[inventoryStock] Restored stock for order #${order.id} (${order.orderNumber || order.documentId}): ${JSON.stringify(changes)}`
    );

    return { restored: true, orderId: order.id, changes };
  } catch (err) {
    strapi.log.error(
      `[inventoryStock] Restore failed: ${err.message}`
    );
    return { restored: false, reason: 'error', error: err.message };
  }
}

/**
 * Handle paymentStatus transitions (paid ↔ refund).
 */
async function handleOrderPaymentStatusInventory(
  strapi,
  orderRef,
  nextPaymentStatus
) {
  if (!nextPaymentStatus) {
    return { handled: false, reason: 'no_status' };
  }

  if (nextPaymentStatus === 'paid') {
    const result = await applyOrderInventoryDeduction(strapi, orderRef);
    return { handled: true, action: 'deduct', ...result };
  }

  if (nextPaymentStatus === 'refund') {
    const result = await restoreOrderInventory(strapi, orderRef);
    return { handled: true, action: 'restore', ...result };
  }

  return { handled: false, reason: 'ignored_status', status: nextPaymentStatus };
}

module.exports = {
  findInventoryForOrderItem,
  applyOrderInventoryDeduction,
  restoreOrderInventory,
  handleOrderPaymentStatusInventory,
};
