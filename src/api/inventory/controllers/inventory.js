'use strict';

/**
 * inventory controller — Admin stock management for the storefront account UI.
 */

async function requireAdminUser(strapi, ctx) {
  const userId = ctx.state.user?.id;
  if (!userId) {
    ctx.unauthorized();
    return null;
  }

  const user = await strapi.db
    .query('plugin::users-permissions.user')
    .findOne({
      where: { id: userId },
      populate: ['role'],
    });

  const roleName = user?.role?.name || user?.role?.type;
  if (!user || roleName !== 'Admin') {
    ctx.forbidden('Admin role required');
    return null;
  }

  return user;
}

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseNonNegativeInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function buildStockFilter(stockStatus) {
  if (!stockStatus || stockStatus === 'all') return null;

  if (stockStatus === 'out_of_stock') {
    return { stock: { $lte: 0 } };
  }

  if (stockStatus === 'in_stock') {
    return { stock: { $gt: 0 } };
  }

  // low_stock handled after fetch when threshold is per-row; use stock > 0
  if (stockStatus === 'low_stock') {
    return { stock: { $gt: 0 } };
  }

  return null;
}

module.exports = {
  /**
   * GET /api/inventories
   * Query: page, pageSize, search, stockStatus, activeOnly
   */
  async find(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const {
      page = '1',
      pageSize = '25',
      search = '',
      stockStatus = 'all',
      activeOnly = '',
    } = ctx.query || {};

    const pageNum = parsePositiveInt(page, 1);
    const pageSizeNum = Math.min(parsePositiveInt(pageSize, 25), 100);
    const searchTerm = String(search || '').trim();

    const where = {};
    if (String(activeOnly).toLowerCase() === 'true') {
      where.isActive = true;
    }

    const stockFilter = buildStockFilter(stockStatus);
    if (stockFilter) Object.assign(where, stockFilter);

    if (searchTerm) {
      where.$or = [
        { productName: { $containsi: searchTerm } },
        { sku: { $containsi: searchTerm } },
        { notes: { $containsi: searchTerm } },
      ];
    }

    const [rows, total] = await Promise.all([
      strapi.db.query('api::inventory.inventory').findMany({
        where,
        populate: ['product_details'],
        orderBy: { productName: 'asc' },
        offset: (pageNum - 1) * pageSizeNum,
        limit: pageSizeNum,
      }),
      strapi.db.query('api::inventory.inventory').count({ where }),
    ]);

    const service = strapi.service('api::inventory.inventory');
    let data = rows.map((row) => service.serialize(row));

    // Per-row low-stock filter (depends on each item's threshold)
    if (stockStatus === 'low_stock') {
      data = data.filter((row) => row.stockStatus === 'low_stock');
    }

    const pageCount = Math.max(1, Math.ceil(total / pageSizeNum));

    ctx.body = {
      data,
      meta: {
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          pageCount,
          total: stockStatus === 'low_stock' ? data.length : total,
        },
      },
    };
  },

  /**
   * GET /api/inventories/:id
   */
  async findOne(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const { id } = ctx.params;
    const entry = await strapi.db.query('api::inventory.inventory').findOne({
      where: { id },
      populate: ['product_details'],
    });

    if (!entry) {
      return ctx.notFound('Inventory not found');
    }

    ctx.body = {
      data: strapi.service('api::inventory.inventory').serialize(entry),
    };
  },

  /**
   * POST /api/inventories
   * Body: productName, sku, stock, lowStockThreshold, notes, isActive, productDetailIds
   */
  async create(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const body = ctx.request.body || {};
    const productName = String(body.productName || '').trim();
    if (!productName) {
      return ctx.badRequest('productName is required');
    }

    const stock = parseNonNegativeInt(body.stock, 0);
    const lowStockThreshold = parseNonNegativeInt(body.lowStockThreshold, 10);
    const productDetailIds = Array.isArray(body.productDetailIds)
      ? body.productDetailIds.map((id) => Number(id)).filter((id) => id > 0)
      : [];

    const created = await strapi.db.query('api::inventory.inventory').create({
      data: {
        productName,
        sku: String(body.sku || '').trim() || null,
        stock,
        lowStockThreshold,
        notes: body.notes != null ? String(body.notes) : null,
        isActive: body.isActive !== false,
      },
    });

    if (productDetailIds.length) {
      for (const detailId of productDetailIds) {
        await strapi.db.query('api::product-detail.product-detail').update({
          where: { id: detailId },
          data: {
            inventory: created.id,
            isOutOfStock: stock <= 0,
          },
        });
      }
    }

    await strapi.service('api::inventory.inventory').syncProductDetailStockFlags(
      created.id,
      stock,
    );

    const entry = await strapi.db.query('api::inventory.inventory').findOne({
      where: { id: created.id },
      populate: ['product_details'],
    });

    ctx.body = {
      data: strapi.service('api::inventory.inventory').serialize(entry),
    };
  },

  /**
   * PUT /api/inventories/:id
   */
  async update(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const { id } = ctx.params;
    const existing = await strapi.db.query('api::inventory.inventory').findOne({
      where: { id },
      populate: ['product_details'],
    });

    if (!existing) {
      return ctx.notFound('Inventory not found');
    }

    const body = ctx.request.body || {};
    const data = {};

    if (body.productName !== undefined) {
      const productName = String(body.productName || '').trim();
      if (!productName) return ctx.badRequest('productName is required');
      data.productName = productName;
    }
    if (body.sku !== undefined) {
      data.sku = String(body.sku || '').trim() || null;
    }
    if (body.stock !== undefined) {
      data.stock = parseNonNegativeInt(body.stock, existing.stock);
    }
    if (body.lowStockThreshold !== undefined) {
      data.lowStockThreshold = parseNonNegativeInt(
        body.lowStockThreshold,
        existing.lowStockThreshold,
      );
    }
    if (body.notes !== undefined) {
      data.notes = body.notes == null ? null : String(body.notes);
    }
    if (body.isActive !== undefined) {
      data.isActive = !!body.isActive;
    }

    await strapi.db.query('api::inventory.inventory').update({
      where: { id },
      data,
    });

    // Replace linked product details when provided
    if (Array.isArray(body.productDetailIds)) {
      const nextIds = body.productDetailIds
        .map((v) => Number(v))
        .filter((v) => v > 0);
      const prevIds = (existing.product_details || []).map((d) => d.id);

      for (const prevId of prevIds) {
        if (!nextIds.includes(prevId)) {
          await strapi.db.query('api::product-detail.product-detail').update({
            where: { id: prevId },
            data: { inventory: null },
          });
        }
      }

      const nextStock =
        data.stock !== undefined ? data.stock : Number(existing.stock) || 0;

      for (const nextId of nextIds) {
        await strapi.db.query('api::product-detail.product-detail').update({
          where: { id: nextId },
          data: {
            inventory: Number(id),
            isOutOfStock: nextStock <= 0,
          },
        });
      }
    }

    const nextStock =
      data.stock !== undefined ? data.stock : Number(existing.stock) || 0;
    await strapi.service('api::inventory.inventory').syncProductDetailStockFlags(
      Number(id),
      nextStock,
    );

    const entry = await strapi.db.query('api::inventory.inventory').findOne({
      where: { id },
      populate: ['product_details'],
    });

    ctx.body = {
      data: strapi.service('api::inventory.inventory').serialize(entry),
    };
  },

  /**
   * DELETE /api/inventories/:id
   */
  async delete(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const { id } = ctx.params;
    const existing = await strapi.db.query('api::inventory.inventory').findOne({
      where: { id },
      populate: ['product_details'],
    });

    if (!existing) {
      return ctx.notFound('Inventory not found');
    }

    // Unlink product details before delete
    for (const detail of existing.product_details || []) {
      await strapi.db.query('api::product-detail.product-detail').update({
        where: { id: detail.id },
        data: { inventory: null },
      });
    }

    await strapi.db.query('api::inventory.inventory').delete({
      where: { id },
    });

    ctx.body = { data: { id: Number(id), deleted: true } };
  },

  /**
   * POST /api/inventories/:id/adjust-stock
   * Body: { delta?: number, stock?: number }
   */
  async adjustStock(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const { id } = ctx.params;
    const existing = await strapi.db.query('api::inventory.inventory').findOne({
      where: { id },
    });

    if (!existing) {
      return ctx.notFound('Inventory not found');
    }

    const body = ctx.request.body || {};
    let nextStock = Number(existing.stock) || 0;

    if (body.stock !== undefined && body.stock !== null && body.stock !== '') {
      nextStock = parseNonNegativeInt(body.stock, nextStock);
    } else if (body.delta !== undefined && body.delta !== null && body.delta !== '') {
      const delta = parseInt(body.delta, 10);
      if (!Number.isFinite(delta)) {
        return ctx.badRequest('delta must be an integer');
      }
      nextStock = Math.max(0, nextStock + delta);
    } else {
      return ctx.badRequest('Provide stock or delta');
    }

    await strapi.db.query('api::inventory.inventory').update({
      where: { id },
      data: { stock: nextStock },
    });

    await strapi.service('api::inventory.inventory').syncProductDetailStockFlags(
      Number(id),
      nextStock,
    );

    const entry = await strapi.db.query('api::inventory.inventory').findOne({
      where: { id },
      populate: ['product_details'],
    });

    ctx.body = {
      data: strapi.service('api::inventory.inventory').serialize(entry),
    };
  },

  /**
   * GET /api/inventories/product-details/options
   * Lists product details for linking (optionally unlinked only).
   */
  async productDetailOptions(ctx) {
    const admin = await requireAdminUser(strapi, ctx);
    if (!admin) return;

    const {
      search = '',
      unlinkedOnly = 'false',
      page = '1',
      pageSize = '50',
    } = ctx.query || {};

    const pageNum = parsePositiveInt(page, 1);
    const pageSizeNum = Math.min(parsePositiveInt(pageSize, 50), 200);
    const searchTerm = String(search || '').trim();
    const where = {};

    if (String(unlinkedOnly).toLowerCase() === 'true') {
      where.inventory = null;
    }

    if (searchTerm) {
      where.$or = [
        { productId: { $containsi: searchTerm } },
        { quantity: { $containsi: searchTerm } },
        { priceRange: { $containsi: searchTerm } },
      ];
    }

    const [rows, total] = await Promise.all([
      strapi.db.query('api::product-detail.product-detail').findMany({
        where,
        populate: ['inventory'],
        orderBy: { id: 'asc' },
        offset: (pageNum - 1) * pageSizeNum,
        limit: pageSizeNum,
      }),
      strapi.db.query('api::product-detail.product-detail').count({ where }),
    ]);

    ctx.body = {
      data: rows.map((d) => ({
        id: d.id,
        documentId: d.documentId,
        productId: d.productId || '',
        quantity: d.quantity || '',
        priceRange: d.priceRange || '',
        isOutOfStock: !!d.isOutOfStock,
        isFoodProduct: !!d.isFoodProduct,
        isService: !!d.isService,
        inventoryId: d.inventory?.id || null,
        inventoryName: d.inventory?.productName || null,
      })),
      meta: {
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          pageCount: Math.max(1, Math.ceil(total / pageSizeNum)),
          total,
        },
      },
    };
  },
};
