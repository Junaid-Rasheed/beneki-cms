const nodemailer = require("nodemailer");

module.exports = {
  async sendInvoice(ctx) {
    console.log("🚀 [sendInvoice] Incoming request to /api/invoices/send");

    try {
      const { orderId, invoicePdf, fileName } = ctx.request.body;
      console.log("📦 Payload received:", { orderId, hasPdf: !!invoicePdf, fileName });

      if (!orderId || !invoicePdf) {
        console.warn("⚠️ Missing orderId or invoicePdf in payload");
        return ctx.badRequest("Missing orderId or invoicePdf");
      }

      // 🧠 Fetch order data
      console.log("🔍 Fetching order from DB for documentId:", orderId);
      const order = await strapi.db.query("api::order.order").findOne({
        where: { documentId: orderId },
        populate: { customer: true, user: true }, // ✅ also populate user
      });

      console.log("📄 Order fetched from DB:", order ? "✅ Found" : "❌ Not found");

      if (!order) {
        console.warn("⚠️ No order found for documentId:", orderId);
        return ctx.notFound("Order not found");
      }

      // 🔎 Log both possible relations
      console.log("👤 Customer field:", order.customer);
      console.log("👥 User field:", order.user);

      // Try both possible fields for email
      const email =
        order.customer?.email ||
        order.user?.email ||
        order.clientEmail ||
        order.billingAddress?.email ||
        null;

      console.log("📧 Extracted customer email:", email || "❌ None found");

      if (!email) {
        console.warn("⚠️ Order does not have a valid customer email");
        return ctx.badRequest("Order does not have a customer email");
      }

      // 📨 Prepare mail transporter
      console.log("✉️ Creating nodemailer transporter...");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      console.log("📤 Sending invoice email to:", email);

      await transporter.sendMail({
        from: `"Beneki" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Invoice for Order ${orderId}`,
        text: "Please find your invoice attached.",
        attachments: [
          {
            filename: fileName || `invoice-${orderId}.pdf`,
            content: Buffer.from(invoicePdf, "base64"),
          },
        ],
      });

      console.log("✅ Invoice email sent successfully to:", email);

      return ctx.send({ success: true, message: "Invoice sent successfully!" });

    } catch (error) {
      console.error("💥 [sendInvoice] Fatal error:", error);
      return ctx.internalServerError("Failed to send invoice");
    }
  },
};
