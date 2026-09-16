'use strict';

const { collectOrderItemBoxTrackings } = require('./dpdTrackingSync');

/**
 * Mark every non-delivered box tracking as delivered and set the order status
 * to delivered. Used by admin GLS/DPD delayed & missed exception UIs.
 */
async function markOrderAsCompleted(strapi, documentId) {
  if (!documentId) {
    const err = new Error('Order documentId is required');
    err.status = 400;
    throw err;
  }

  const order = await strapi.db.query('api::order.order').findOne({
    where: { documentId },
    populate: {
      orderItems: {
        populate: {
          shipment_trackings: true,
        },
      },
      shipment_trackings: true,
    },
  });

  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  const boxes = collectOrderItemBoxTrackings(order);
  const undelivered = boxes.filter(
    (box) =>
      box?.documentId &&
      String(box.status || '').toLowerCase() !== 'delivered'
  );

  for (const box of undelivered) {
    await strapi.documents('api::shipment-tracking.shipment-tracking').update({
      documentId: box.documentId,
      data: { status: 'delivered' },
    });
  }

  // Also advance any order-level master tracking still short of delivered.
  const orderTrackings = Array.isArray(order.shipment_trackings)
    ? order.shipment_trackings
    : [];
  for (const raw of orderTrackings) {
    const tracking = raw?.attributes
      ? { documentId: raw.documentId, ...raw.attributes }
      : raw;
    if (
      !tracking?.documentId ||
      String(tracking.status || '').toLowerCase() === 'delivered'
    ) {
      continue;
    }
    await strapi.documents('api::shipment-tracking.shipment-tracking').update({
      documentId: tracking.documentId,
      data: { status: 'delivered' },
    });
  }

  let updatedOrder = order;
  if (String(order.orderStatus || '').toLowerCase() !== 'delivered') {
    updatedOrder = await strapi.documents('api::order.order').update({
      documentId: order.documentId,
      data: { orderStatus: 'delivered' },
    });
  }

  return {
    order: {
      id: updatedOrder.id,
      documentId: updatedOrder.documentId,
      orderNumber: updatedOrder.orderNumber,
      orderStatus: updatedOrder.orderStatus || 'delivered',
    },
    boxesUpdated: undelivered.length,
  };
}

module.exports = {
  markOrderAsCompleted,
};
