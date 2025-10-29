"use strict";

const sendInvoiceEmail = require("../utils/sendInvoiceEmail"); // import utility

module.exports = {
  async sendInvoiceEmailHandler(ctx) {
    try {
      console.log("🚀 [sendInvoiceEmailHandler] Incoming request to /api/invoices/send");

      const { orderId, fileName, invoicePdf } = ctx.request.body;

      if (!orderId || !invoicePdf || !fileName) {
        return ctx.badRequest("Missing required fields (orderId, fileName, invoicePdf)");
      }

      console.log("📦 Payload received:", { orderId, fileName });

      // 🔍 Find order from DB
      const order = await strapi.db.query("api::order.order").findOne({
        where: { documentId: orderId },
        populate: ["user"],
      });

      if (!order) {
        return ctx.notFound("Order not found");
      }

      const customerEmail = order.user?.email;
      if (!customerEmail) {
        return ctx.badRequest("Order does not have a customer email");
      }

      console.log("📧 Sending invoice email to:", customerEmail);

      // ✅ Call utility to send email
      // The utility expects: toEmail, order object, pdfPath/base64
      // Here we are passing the base64 PDF content as a temporary file path
      // But for simplicity, we can modify the util to accept base64 directly
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
