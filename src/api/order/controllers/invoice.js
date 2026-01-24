"use strict";

const sendInvoiceEmail = require("../utils/sendInvoiceEmail"); // import utility

module.exports = {
  async sendInvoiceEmailHandler(ctx) {
    try {
      console.log("🚀 [sendInvoiceEmailHandler] Incoming request to /api/invoices/send");

      // Log full request body
      console.log("📥 Raw request body:", ctx.request.body);

      const { orderId, fileName, invoicePdf,locale  } = ctx.request.body;
      console.log("🌍 Locale received in Strapi:", locale);


      console.log("🔹 Extracted fields:");
      console.log("orderId:", orderId);
      console.log("fileName:", fileName);
      console.log("invoicePdf present:", !!invoicePdf);
      if (invoicePdf) console.log("invoicePdf length:", invoicePdf.length);

      if (!orderId || !invoicePdf || !fileName) {
        console.warn("⚠️ Missing required fields", { orderId, fileName, invoicePdf });
        return ctx.badRequest("Missing required fields (orderId, fileName, invoicePdf)");
      }

      // 🔍 Find order from DB
      console.log("🔍 Querying order from DB with documentId:", orderId);
      const order = await strapi.db.query("api::order.order").findOne({
        where: { documentId: orderId },
        populate: [
          "user",
          "products",
          "paymentData",
          "vatBreakdown",
          "bankDetails"
        ],
      });

      console.log("🔍 Fetched order from DB:", order);

      if (!order) {
        console.warn("⚠️ Order not found for documentId:", orderId);
        return ctx.notFound("Order not found");
      }

      console.log("🔹 Order details:");
      console.log("Order ID:", order.id);
      console.log("Document ID:", order.documentId);
      console.log("User ID:", order.user?.id);
      console.log("User email:", order.user?.email);
      console.log("Products:", order.products);
      console.log("Payment Data:", order.paymentData);
      console.log("VAT Breakdown:", order.vatBreakdown);
      console.log("Bank Details:", order.bankDetails);

      const customerEmail = order.user?.email;
      if (!customerEmail) {
        console.warn("⚠️ Order has no customer email:", order);
        return ctx.badRequest("Order does not have a customer email");
      }

      console.log("📧 Customer email:", customerEmail);

      // ✅ Call utility to send email
      console.log("📤 Calling sendInvoiceEmail utility with parameters:");
      console.log("Email:", customerEmail);
      console.log("Order object:", { ...order, fileName });
      console.log("Invoice PDF length:", invoicePdf.length);

      await sendInvoiceEmail(customerEmail, { ...order, fileName }, invoicePdf,locale );

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
