"use strict";

const sgMail = require("@sendgrid/mail");
const fs = require("fs");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async function sendInvoiceEmail(
  toEmail,
  order,
  pdfDataOrPath,
  locale = "en"
) {
  

  try {
    let pdfBase64;
    if (Buffer.isBuffer(pdfDataOrPath)) {
      pdfBase64 = pdfDataOrPath.toString("base64");
    } else if (typeof pdfDataOrPath === "string") {
      pdfBase64 = pdfDataOrPath;
    } else {
      const pdfBuffer = fs.readFileSync(pdfDataOrPath);
      pdfBase64 = pdfBuffer.toString("base64");
    }

    const normalizedLocale =
      typeof locale === "string"
        ? locale.toLowerCase().split(/[-_]/)[0]
        : "en";

    const templates = await strapi.entityService.findMany(
      "api::static-email-template.static-email-template",
      {
        locale: normalizedLocale,
        limit: 1,
      }
    );

    const t =
      templates[0] ||
      (
        await strapi.entityService.findMany(
          "api::static-email-template.static-email-template",
          {
            locale: "en",
            limit: 1,
          }
        )
      )[0];

    if (!t) {
      throw new Error("Static email template not found");
    }

    const msg = {
      to: toEmail,
      from: "info@beneki.net",
      subject: `${t.subject} #${order.orderNumber || order.documentId}`,
      text: `Thank you for your purchase! Please find your invoice attached.`,
      html: `<div>
  <h2>${t.title}</h2>
  <p>
    ${t.processed}
    <strong>#${order.orderNumber || order.documentId}</strong>
  </p>
  <p>${t.invoice}</p>
  <br />
  <p>${t.regards},<br />BENEKI Team</p>
</div>`,
      attachments: [
        {
          content: pdfBase64,
          filename:
            order.fileName ||
            `invoice-${order.orderNumber || order.documentId}.pdf`,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    };

    await sgMail.send(msg);
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};
