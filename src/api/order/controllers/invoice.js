"use strict";

const sendInvoiceEmail = require("../utils/sendInvoiceEmail"); // import utility

module.exports = {
  async sendInvoiceEmailHandler(ctx) {
    try {
      
      
      const { orderId, fileName, invoicePdf,locale  } = ctx.request.body;
      
      if (!orderId || !invoicePdf || !fileName) {
        console.warn("⚠️ Missing required fields", { orderId, fileName, invoicePdf });
        return ctx.badRequest("Missing required fields (orderId, fileName, invoicePdf)");
      }
      // 🔍 Find order from DB
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

      if (!order) {
        console.warn("⚠️ Order not found for documentId:", orderId);
        return ctx.notFound("Order not found");
      }

      const customerEmail = order.user?.email;
      if (!customerEmail) {
        console.warn("⚠️ Order has no customer email:", order);
        return ctx.badRequest("Order does not have a customer email");
      }
      await sendInvoiceEmail(customerEmail, { ...order, fileName }, invoicePdf,locale );
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

    let params = [];

    if (userId) {
      query += `
        LEFT JOIN up_users_affiliated_by_lnk a 
          ON u."id" = a."user_id"
        WHERE a."inv_user_id" = ?
          AND o."created_at" >= ? 
          AND o."created_at" <= ?
          AND o."order_status" IN ('processing','shipped','delivered')
      `;

      params = [userId, startDate, endDate]; // ✅ correct order
    } else {
      query += `
        WHERE o."created_at" >= ? 
          AND o."created_at" <= ?
          AND o."order_status" IN ('processing','shipped','delivered')
      `;

      params = [startDate, endDate]; // ✅ correct
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
