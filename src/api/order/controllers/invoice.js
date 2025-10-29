"use strict";

const sgMail = require("@sendgrid/mail");

module.exports = {
  async sendInvoice(ctx) {
    try {
      console.log("🚀 [sendInvoice] Incoming request to /api/invoices/send");

      const { orderId, fileName, invoicePdf } = ctx.request.body;

      if (!orderId || !invoicePdf || !fileName) {
        return ctx.badRequest("Missing required fields (orderId, fileName, invoicePdf)");
      }

      console.log("📦 Payload received:", { orderId, fileName });

      // ✅ Set SendGrid API Key
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

      console.log("📧 Sending to:", customerEmail);

      // ✅ Build SendGrid email
      const msg = {
        to: customerEmail,
        from: process.env.SENDGRID_FROM_EMAIL || "noreply@yourdomain.com", // fallback
        subject: `Invoice for Order ${orderId}`,
        text: "Please find your invoice attached.",
        html: `
          <div>
            <h3>Thank you for your order!</h3>
            <p>Your invoice for order <strong>${orderId}</strong> is attached.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        `,
        attachments: [
          {
            content: invoicePdf, // base64 PDF
            filename: fileName,
            type: "application/pdf",
            disposition: "attachment",
          },
        ],
      };

      // ✅ Send email
      await sgMail.send(msg);
      console.log("✅ Invoice email sent successfully to:", customerEmail);

      return ctx.send({ success: true, message: "Invoice sent successfully" });

    } catch (error) {
      console.error("❌ [sendInvoice] Failed to send invoice:", error);

      // ✅ Proper error return
      return ctx.internalServerError("Failed to send invoice", {
        details: error.message || error,
      });
    }
  },
};
