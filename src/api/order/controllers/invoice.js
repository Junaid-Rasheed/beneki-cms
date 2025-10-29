const sgMail = require("@sendgrid/mail");

module.exports = {
  async sendInvoice(ctx) {
    try {
      console.log("🚀 [sendInvoice] Incoming request to /api/invoices/send");

      const { orderId, fileName, invoicePdf } = ctx.request.body;

      console.log("📦 Payload received:", { orderId, fileName });

      // ✅ Set SendGrid API Key
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      // 🔍 Find order
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

      // ✅ Send email with attachment
      const msg = {
        to: customerEmail,
        from: process.env.SENDGRID_FROM_EMAIL, // e.g. "noreply@yourdomain.com"
        subject: `Invoice for Order ${orderId}`,
        text: "Please find your invoice attached.",
        attachments: [
          {
            content: invoicePdf, // base64 PDF
            filename: fileName,
            type: "application/pdf",
            disposition: "attachment",
          },
        ],
      };

      await sgMail.send(msg);
      console.log("✅ Invoice email sent successfully!");

      return ctx.send({ success: true });
    } catch (error) {
      console.error("❌ [sendInvoice] Failed to send invoice:", error);
      return ctx.internalServerError("Failed to send invoice", {
        details: error.message,
      });
    }
  },
};
