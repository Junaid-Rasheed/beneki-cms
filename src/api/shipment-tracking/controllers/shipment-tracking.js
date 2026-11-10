"use strict";

/**
 * shipment-tracking controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const dpdService = require("../../dpd/services/dpd");
const glsService = require("../../gls/services/gls");
const {
  getCountryPrefix,
  buildSlaveRequestsForOrder,
  pickSlaveForTracking,
} = require("../../../helpers/labelGenerator");

const STREET_MIN_LETTERS_OR_DIGITS = 5;

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

async function findOrderForRegenerate(documentId) {
  return strapi.db.query("api::order.order").findOne({
    where: {
      $or: [
        { shipment_trackings: { documentId } },
        { orderItems: { shipment_trackings: { documentId } } },
      ],
    },
    populate: ["shippingAddress", "billingAddress"],
  });
}

async function requireAdminUser(ctx) {
  const userId = ctx.state.user?.id;
  if (!userId) {
    ctx.unauthorized();
    return null;
  }

  const user = await strapi.db.query("plugin::users-permissions.user").findOne({
    where: { id: userId },
    populate: ["role"],
  });

  const roleName = user?.role?.name || user?.role?.type;
  if (!user || roleName !== "Admin") {
    ctx.forbidden("Admin role required");
    return null;
  }

  return user;
}

function isFranceCountry(country) {
  const value = String(country || "").trim().toLowerCase();
  return value === "fr" || value === "france";
}

function countStreetLettersAndDigits(street) {
  if (street == null) return 0;
  const matches = String(street).match(/[\p{L}\p{N}]/gu);
  return matches ? matches.length : 0;
}

function isStreetDetailedEnough(street) {
  return countStreetLettersAndDigits(street) >= STREET_MIN_LETTERS_OR_DIGITS;
}

function isLegacyAddressFormat(address) {
  if (!address?.street?.trim() || address.appartment?.trim()) return false;
  const street = String(address.street || "").trim();
  const addressName = String(address.addressName || "").trim();
  return (
    isStreetDetailedEnough(addressName) &&
    street.length > 0 &&
    !isStreetDetailedEnough(street)
  );
}

function getPrimaryAddressLine(address) {
  if (!address) return "";
  const street = String(address.street || "").trim();
  const addressName = String(address.addressName || "").trim();

  if (street && isStreetDetailedEnough(street)) return street;
  if (addressName && isStreetDetailedEnough(addressName)) return addressName;
  return street || addressName;
}

function getAddressExtraLine(address) {
  if (!address) return "";
  const extra = String(address.appartment || "").trim();
  if (extra) return extra;
  if (isLegacyAddressFormat(address)) {
    return String(address.street || "").trim();
  }
  return "";
}

function buildCarrierReceiver(order) {
  const shippingAddress = order?.shippingAddress;
  const billingAddress = order?.billingAddress;
  if (!shippingAddress) {
    throw new Error("No shipping address found on the order.");
  }

  const receiverFullName = [shippingAddress.firstName, shippingAddress.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const receiverName =
    receiverFullName || shippingAddress.companyName || "Customer";
  const fullInstruction = String(shippingAddress.instruction || "")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const receiverStreet = [
    getPrimaryAddressLine(shippingAddress),
    getAddressExtraLine(shippingAddress),
  ]
    .filter(Boolean)
    .join(", ");

  return {
    name: receiverName,
    countryPrefix: getCountryPrefix(shippingAddress.country),
    zipCode: shippingAddress.postalCode || "",
    city: shippingAddress.city || "",
    street: receiverStreet,
    phoneNumber: shippingAddress.phoneNumber || "",
    deliveryInstruction: fullInstruction.slice(0, 36),
    deliveryInstruction2: fullInstruction.slice(36, 72),
    companyName: shippingAddress.companyName,
    email: shippingAddress.email || billingAddress?.email || "",
  };
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

    async regenerate(ctx) {
      const admin = await requireAdminUser(ctx);
      if (!admin) return;

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

      if (!tracking.barCodeId) {
        return ctx.badRequest("Shipment tracking has no barcode");
      }

      const order = await findOrderForRegenerate(documentId);
      if (!order) {
        return ctx.notFound("Order for this shipment tracking was not found");
      }

      let carrierOrder = order;
      if (order.documentId) {
        const populated = await strapi.documents("api::order.order").findOne({
          documentId: order.documentId,
          populate: {
            shippingAddress: true,
            billingAddress: true,
            orderItems: {
              populate: {
                shipment_trackings: true,
              },
            },
          },
        });
        if (populated) carrierOrder = populated;
      }

      try {
        const receiver = buildCarrierReceiver(carrierOrder);
        let result;
        if (isFranceCountry(carrierOrder.shippingAddress?.country)) {
          result = await dpdService.regenerateShipmentLabel({
            tracking,
            receiver,
            orderNumber: carrierOrder.orderNumber,
          });
        } else {
          const slave = pickSlaveForTracking(
            carrierOrder,
            tracking.documentId,
            await buildSlaveRequestsForOrder(carrierOrder),
          );
          result = await glsService.regenerateGlsShipmentLabel({
            tracking,
            receiver,
            orderNumber: carrierOrder.orderNumber,
            orderId: carrierOrder.documentId,
            fallbackWeight: slave?.weight,
            fallbackReference: slave?.referencenumber,
          });
        }

        ctx.body = {
          success: true,
          message: "Label regenerated",
          data: result,
        };
      } catch (error) {
        strapi.log.error(
          `Failed to regenerate label ${documentId}: ${error.message}`,
        );
        ctx.status = 500;
        ctx.body = {
          success: false,
          message: error.message || "Failed to regenerate label",
        };
      }
    },
  }),
);
