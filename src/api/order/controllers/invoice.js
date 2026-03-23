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

  async getTotalsByDate(ctx) {
    try {
      const { startDate, endDate, userId } = ctx.query;

      if (!startDate || !endDate) {
        return ctx.badRequest("startDate and endDate are required");
      }

      let query = `
        SELECT 
          COALESCE(SUM(o."total"), 0) as "totalAmount",
          COALESCE(SUM(o."sub_total"), 0) as "totalAmountExcludeVAT",
          COALESCE(SUM(o."vat"), 0) as "totalVat"
        FROM orders o
        LEFT JOIN orders_user_lnk l ON o."id" = l."order_id"
        LEFT JOIN up_users u ON l."user_id" = u."id"
      `;

      const params = [startDate, endDate];

      // ✅ Filter by affiliated users using the link table
      if (userId) {
        query += `
          LEFT JOIN up_users_affiliated_by_lnk a 
            ON u."id" = a."user_id"
          WHERE a."inv_user_id" = ?
            AND o."created_at" >= ? 
            AND o."created_at" <= ?
            AND o.order_status in ('processing','shipped','delivered')
        `;
        // Note: order of params matters
        params.unshift(userId); // first param is userId
        params.push(startDate, endDate);
      } else {
        // No affiliated filter, just date filter
        query += ` WHERE o."created_at" >= ? AND o."created_at" <= ? AND o.order_status in ('processing','shipped','delivered')`;
      }

      const result = await strapi.db.connection.raw(query, params);

      const row = result.rows?.[0] || result[0]?.[0] || {};

      return {
        totalAmount: Number(row.totalAmount) || 0,
        totalAmountExcludeVAT: Number(row.totalAmountExcludeVAT) || 0,
        totalVat: Number(row.totalVat) || 0,
      };

    } catch (error) {
      console.error("Error:", error);
      return ctx.internalServerError("Something went wrong");
    }
  },
};
