// @ts-nocheck
"use strict";

const path = require("path");
const fs = require("fs");
const { createCoreController } = require("@strapi/strapi").factories;
const generateInvoicePDF = require("../utils/generateInvoicePDF");
const sendInvoiceEmail = require("../utils/sendInvoiceEmail");

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async sendInvoice(ctx) {
    try {
      const { orderId, userId } = ctx.request.body;

      if (!orderId || !userId) {
        return ctx.badRequest("Missing orderId or userId");
      }

      // ✅ Fetch order and user info from DB
      const order = await strapi.db.query("api::order.order").findOne({
        where: { documentId: orderId },
        populate: { items: true, user: true },
      });

      if (!order) {
        return ctx.notFound("Order not found");
      }

      const user = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { id: userId },
      });

      if (!user) {
        return ctx.notFound("User not found");
      }

      // ✅ Generate PDF file
      const pdfPath = await generateInvoicePDF(order);

      // ✅ Send email with attachment
      await sendInvoiceEmail(user.email, order, pdfPath);

      // ✅ Clean up PDF file (optional)
      fs.unlinkSync(pdfPath);

      return ctx.send({ success: true, message: "Invoice sent successfully" });
    } catch (err) {
      console.error("Error sending invoice:", err);
      return ctx.internalServerError("Failed to send invoice");
    }
  },
}));
