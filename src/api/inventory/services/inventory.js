'use strict';

/**
 * inventory service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::inventory.inventory', ({ strapi }) => ({
  /**
   * Keep linked product_details.isOutOfStock in sync with inventory stock.
   */
  async syncProductDetailStockFlags(inventoryId, stock) {
    if (!inventoryId) return;

    const outOfStock = Number(stock) <= 0;
    const details = await strapi.db
      .query('api::product-detail.product-detail')
      .findMany({
        where: { inventory: inventoryId },
        select: ['id'],
      });

    for (const detail of details) {
      await strapi.db.query('api::product-detail.product-detail').update({
        where: { id: detail.id },
        data: { isOutOfStock: outOfStock },
      });
    }
  },

  /**
   * Normalize inventory entity for API responses.
   */
  serialize(entry) {
    if (!entry) return null;

    const stock = Number(entry.stock) || 0;
    const threshold =
      entry.lowStockThreshold == null ? 10 : Number(entry.lowStockThreshold);
    const productDetails = Array.isArray(entry.product_details)
      ? entry.product_details
      : [];

    return {
      id: entry.id,
      documentId: entry.documentId,
      productName: entry.productName || '',
      sku: entry.sku || '',
      stock,
      lowStockThreshold: threshold,
      notes: entry.notes || '',
      isActive: entry.isActive !== false,
      stockStatus:
        stock <= 0 ? 'out_of_stock' : stock <= threshold ? 'low_stock' : 'in_stock',
      productDetails: productDetails.map((d) => ({
        id: d.id,
        documentId: d.documentId,
        productId: d.productId || '',
        quantity: d.quantity || '',
        priceRange: d.priceRange || '',
        isOutOfStock: !!d.isOutOfStock,
        isFoodProduct: !!d.isFoodProduct,
        isService: !!d.isService,
        maximumWeight: d.maximumWeight ?? null,
        maximumVariation: d.maximumVariation ?? null,
      })),
      productDetailCount: productDetails.length,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  },
}));
