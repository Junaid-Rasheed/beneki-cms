// "use strict";

// const sgMail = require("@sendgrid/mail");
// const fs = require("fs");
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// module.exports = async function sendInvoiceEmail(
//   toEmail,
//   order,
//   pdfDataOrPath,
//   locale = "en",
// ) { console.log("🌍 Locale received in sendInvoiceEmail:", locale);

//   try {
//     console.log("📧 Preparing to send invoice email to:", toEmail);
//     console.log("📄 Order data:", order);
//     console.log("📦 PDF data type:", typeof pdfDataOrPath);

//     let pdfBase64;
//     if (Buffer.isBuffer(pdfDataOrPath)) {
//       console.log("📦 PDF is a buffer, length:", pdfDataOrPath.length);
//       pdfBase64 = pdfDataOrPath.toString("base64");
//     } else if (typeof pdfDataOrPath === "string") {
//       console.log("📦 PDF is a string, length:", pdfDataOrPath.length);
//       pdfBase64 = pdfDataOrPath;
//     } else {
//       console.log("📂 PDF is assumed to be a file path, reading file...");
//       const pdfBuffer = fs.readFileSync(pdfDataOrPath);
//       pdfBase64 = pdfBuffer.toString("base64");
//       console.log("✅ PDF file read successfully, size:", pdfBuffer.length);
//     }

//     const EMAIL_TRANSLATIONS = {
//       en: {
//         subject: "Your Invoice for Order",
//         title: "Thank you for your purchase!",
//         processed: "Your order has been processed successfully.",
//         invoice: "Please find your invoice attached to this email.",
//         regards: "Best regards",
//       },
//       fr: {
//         subject: "Votre facture pour la commande",
//         title: "Merci pour votre achat !",
//         processed: "Votre commande a été traitée avec succès.",
//         invoice: "Veuillez trouver votre facture en pièce jointe.",
//         regards: "Cordialement",
//       },
//     };

// const normalizedLocale =
//   typeof locale === "string"
//     ? locale.toLowerCase().split(/[-_]/)[0]
//     : "en";

// const t = EMAIL_TRANSLATIONS[normalizedLocale] || EMAIL_TRANSLATIONS.en;
// console.log("🌍 Final locale used for email:", normalizedLocale);


//     const msg = {
//       to: toEmail,
//       from: "elveniaschmall@gmail.com",
//       subject: `${t.subject} #${order.orderNumber || order.documentId}`,
//       text: `Thank you for your purchase! Please find your invoice attached.`,
//       html: `<div>
//   <h2>${t.title}</h2>
//   <p>
//     ${t.processed}
//     <strong>#${order.orderNumber || order.documentId}</strong>
//   </p>
//   <p>${t.invoice}</p>
//   <br />
//   <p>${t.regards},<br />BENEKI Team</p>
// </div>`,
//       attachments: [
//         {
//           content: pdfBase64,
//           filename:
//             order.fileName ||
//             `invoice-${order.orderNumber || order.documentId}.pdf`,
//           type: "application/pdf",
//           disposition: "attachment",
//         },
//       ],
//     };

//     console.log("📤 Email message prepared:", {
//       to: msg.to,
//       subject: msg.subject,
//       attachmentFilename: msg.attachments[0].filename,
//       attachmentSize: pdfBase64.length,
//     });

//     await sgMail.send(msg);
//     console.log("✅ Email sent successfully to:", toEmail);
//   } catch (error) {
//     console.error("❌ Error sending email:", error);
//     throw error;
//   }
// };


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
  console.log("🌍 Locale received in sendInvoiceEmail:", locale);

  try {
    console.log("📧 Preparing to send invoice email to:", toEmail);
    console.log("📄 Order data:", order);
    console.log("📦 PDF data type:", typeof pdfDataOrPath);

    let pdfBase64;
    if (Buffer.isBuffer(pdfDataOrPath)) {
      console.log("📦 PDF is a buffer, length:", pdfDataOrPath.length);
      pdfBase64 = pdfDataOrPath.toString("base64");
    } else if (typeof pdfDataOrPath === "string") {
      console.log("📦 PDF is a string, length:", pdfDataOrPath.length);
      pdfBase64 = pdfDataOrPath;
    } else {
      console.log("📂 PDF is assumed to be a file path, reading file...");
      const pdfBuffer = fs.readFileSync(pdfDataOrPath);
      pdfBase64 = pdfBuffer.toString("base64");
      console.log("✅ PDF file read successfully, size:", pdfBuffer.length);
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

    console.log("🌍 Final locale used for email:", t.locale);

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

    console.log("📤 Email message prepared:", {
      to: msg.to,
      subject: msg.subject,
      attachmentFilename: msg.attachments[0].filename,
      attachmentSize: pdfBase64.length,
    });

    await sgMail.send(msg);
    console.log("✅ Email sent successfully to:", toEmail);
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};
