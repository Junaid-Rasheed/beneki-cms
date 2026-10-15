'use strict';

/**
 * Persist inventory create / update / stock-adjust / delete events.
 * Logs are stored by id + name so they remain readable after a row is deleted.
 */

function actorFromUser(user) {
  const name =
    user?.displayName ||
    [user?.firstName, user?.name].filter(Boolean).join(' ').trim() ||
    user?.username ||
    user?.email ||
    null;

  return {
    updatedByName: name,
    updatedByEmail: user?.email || null,
  };
}

function snapshotInventory(entry) {
  if (!entry) return null;

  const details = Array.isArray(entry.product_details)
    ? entry.product_details
    : [];
  const rawPrice = entry.purchasePrice;
  const purchasePrice =
    rawPrice == null || rawPrice === '' ? null : Number(rawPrice);

  return {
    productName: entry.productName || '',
    sku: entry.sku || '',
    stock: Number(entry.stock) || 0,
    lowStockThreshold:
      entry.lowStockThreshold == null ? 10 : Number(entry.lowStockThreshold),
    purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : null,
    notes: entry.notes || '',
    isActive: entry.isActive !== false,
    productDetailIds: details
      .map((detail) => detail.id)
      .filter((id) => id != null)
      .sort((a, b) => a - b),
  };
}

function emptyAsNull(value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value) && value.length === 0) return null;
  return value;
}

function diffSnapshots(previous, next) {
  const changes = {};
  const keys = new Set([
    ...Object.keys(previous || {}),
    ...Object.keys(next || {}),
  ]);

  for (const key of keys) {
    const from = emptyAsNull(previous ? previous[key] : null);
    const to = emptyAsNull(next ? next[key] : null);
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[key] = { from, to };
    }
  }

  return changes;
}

async function writeInventoryAuditLog(strapi, entry) {
  const previousData = entry.previousData || null;
  const nextData = entry.nextData || null;

  await strapi.db
    .query('api::inventory-audit-log.inventory-audit-log')
    .create({
      data: {
        inventoryId:
          entry.inventoryId != null ? String(entry.inventoryId) : null,
        inventoryDocumentId: entry.inventoryDocumentId
          ? String(entry.inventoryDocumentId)
          : null,
        productName:
          entry.productName ||
          previousData?.productName ||
          nextData?.productName ||
          null,
        sku: entry.sku || previousData?.sku || nextData?.sku || null,
        action: entry.action,
        changedAt: entry.changedAt || new Date().toISOString(),
        updatedByName: entry.updatedByName || null,
        updatedByEmail: entry.updatedByEmail || null,
        changes: entry.changes || {},
        previousData,
        nextData,
      },
    });
}

module.exports = {
  actorFromUser,
  snapshotInventory,
  diffSnapshots,
  writeInventoryAuditLog,
};
