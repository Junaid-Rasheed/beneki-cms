"use strict";

/**
 * shipment-tracking controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

function normalizeZpl(labelData) {
  if (!labelData) return [];
  if (Array.isArray(labelData)) {
    return labelData.filter((entry) => typeof entry === "string" && entry);
  }
  if (typeof labelData === "string") {
    return [labelData];
  }
  return [];
}

async function findOrderForTracking(documentId) {
  return strapi.db.query("api::order.order").findOne({
    where: {
      $or: [
        { shipment_trackings: { documentId } },
        { orderItems: { shipment_trackings: { documentId } } },
      ],
    },
    select: ["orderNumber", "documentId"],
  });
}

module.exports = createCoreController(
  "api::shipment-tracking.shipment-tracking",
  ({ strapi }) => ({
    async reprint(ctx) {
      const documentId = ctx.params.documentId || ctx.params.id;

      if (!documentId) {
        return ctx.badRequest("Shipment tracking documentId is required");
      }

      const tracking = await strapi
        .documents("api::shipment-tracking.shipment-tracking")
        .findOne({ documentId });

      if (!tracking) {
        return ctx.notFound("Shipment tracking not found");
      }

      const zpl = normalizeZpl(tracking.labelData);

      if (!zpl.length) {
        return ctx.badRequest(
          "No label data stored for this shipment tracking",
        );
      }

      const order = await findOrderForTracking(documentId);
      const barcodePart = tracking.barCodeId || tracking.documentId;
      const reprintOrderNumber = order?.orderNumber
        ? `${order.orderNumber}-${barcodePart}-${Date.now()}`
        : `reprint-${barcodePart}-${Date.now()}`;

      const printJob = await strapi
        .documents("api::print-labels-job.print-labels-job")
        .create({
          data: {
            orderNumber: reprintOrderNumber,
            zpl,
            labelStatus: "Pending",
            attempts: 0,
          },
        });

      ctx.body = {
        success: true,
        message: "Reprint job created",
        data: {
          printJobId: printJob.documentId,
          orderNumber: reprintOrderNumber,
          barCodeId: tracking.barCodeId,
        },
      };
    },
  }),
);
