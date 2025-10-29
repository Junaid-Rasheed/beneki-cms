const nodemailer = require("nodemailer");

module.exports = {
  async sendInvoice(ctx) {
    try {
      const { orderId, invoicePdf, fileName } = ctx.request.body;

      if (!orderId || !invoicePdf) {
        return ctx.badRequest("Missing orderId or invoicePdf");
      }

      // Fetch the order data from Strapi
      const order = await strapi.db.query("api::order.order").findOne({
        where: { documentId: orderId },
        populate: { customer: true },
      });

      if (!order) {
        return ctx.notFound("Order not found");
      }

      const email = order.customer?.email;
      if (!email) {
        return ctx.badRequest("Order does not have a customer email");
      }

      // 📨 Send invoice via email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

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

      return ctx.send({ success: true, message: "Invoice sent successfully!" });
    } catch (error) {
      console.error("❌ Send invoice error:", error);
      return ctx.internalServerError("Failed to send invoice");
    }
  },
};
