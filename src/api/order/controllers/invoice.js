"use strict";

const sendInvoiceEmail = require("../utils/sendInvoiceEmail"); // import utility

module.exports = {
  async sendInvoiceEmailHandler(ctx) {
    try {
      console.log("🚀 [sendInvoiceEmailHandler] Incoming request to /api/invoices/send");

      // Log full request body
      console.log("📥 Raw request body:", ctx.request.body);

      const { orderId, fileName, invoicePdf } = ctx.request.body;

      if (!orderId || !invoicePdf || !fileName) {
        console.warn("⚠️ Missing required fields", { orderId, fileName, invoicePdf });
        return ctx.badRequest("Missing required fields (orderId, fileName, invoicePdf)");
      }

      console.log("📦 Parsed payload:", { orderId, fileName, invoicePdfLength: invoicePdf.length });

      // 🔍 Find order from DB
      const order = await strapi.db.query("api::order.order").findOne({
        where: { documentId: orderId },
        populate: ["user"],
      });

      console.log("🔍 Fetched order from DB:", order);

      if (!order) {
        console.warn("⚠️ Order not found for documentId:", orderId);
        return ctx.notFound("Order not found");
      }

      const customerEmail = order.user?.email;
      if (!customerEmail) {
        console.warn("⚠️ Order has no customer email:", order);
        return ctx.badRequest("Order does not have a customer email");
      }

      console.log("📧 Customer email:", customerEmail);

      // ✅ Call utility to send email
      console.log("📤 Calling sendInvoiceEmail utility...");
      await sendInvoiceEmail(customerEmail, { ...order, fileName }, invoicePdf);

      console.log("✅ Invoice email sent successfully");

      return ctx.send({ success: true, message: "Invoice sent successfully" });

    } catch (error) {
      console.error("❌ [sendInvoiceEmailHandler] Failed to send invoice:", error);
      return ctx.internalServerError("Failed to send invoice", {
        details: error.message || error,
      });
    }
  },
};
