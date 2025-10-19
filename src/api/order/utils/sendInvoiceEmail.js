// @ts-nocheck
const sgMail = require("@sendgrid/mail");
const fs = require("fs");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async function sendInvoiceEmail(toEmail, order, pdfPath) {
  const pdfBuffer = fs.readFileSync(pdfPath);

  const msg = {
    to: toEmail,
    from: "no-reply@yourdomain.com",
    subject: `Your Invoice for Order #${order.id}`,
    text: `Thank you for your purchase! Please find your invoice attached.`,
    attachments: [
      {
        content: pdfBuffer.toString("base64"),
        filename: `invoice-${order.id}.pdf`,
        type: "application/pdf",
        disposition: "attachment",
      },
    ],
  };

  await sgMail.send(msg);
};
