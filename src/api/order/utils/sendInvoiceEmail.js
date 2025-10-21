// // @ts-nocheck
// const sgMail = require("@sendgrid/mail");
// const fs = require("fs");
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// module.exports = async function sendInvoiceEmail(toEmail, order, pdfPath) {
//   const pdfBuffer = fs.readFileSync(pdfPath);

//   console.log("PDF BUFFER",pdfBuffer)
  
//   const msg = {
//     to: toEmail,
//     from: "elveniaschmall@gmail.com",
//     subject: `Your Invoice for Order #${order.orderNumber}`,
//     text: `Thank you for your purchase! Please find your invoice attached.`,
//     attachments: [
//       {
//         content: pdfBuffer.toString("base64"),
//         filename: `invoice-${order.orderNumber}.pdf`,
//         type: "application/pdf",
//         disposition: "attachment",
//       },
//     ],
//   };

//   console.log("Message email context",msg)
//   await sgMail.send(msg);
//   console.log("email sent success")

  
// };


// src/utils/sendInvoiceEmail.js - SEPARATE FILE
"use strict";

const sgMail = require("@sendgrid/mail");
const fs = require("fs");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async function sendInvoiceEmail(toEmail, order, pdfPath) {
  try {
    console.log('📧 Preparing to send invoice email to:', toEmail);
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log('✅ PDF buffer loaded, size:', pdfBuffer.length, 'bytes');

    const msg = {
      to: toEmail,
      from: "elveniaschmall@gmail.com",
      subject: `Your Invoice for Order #${order.orderNumber}`,
      text: `Thank you for your purchase! Please find your invoice attached.`,
      html: `
        <div>
          <h2>Thank you for your purchase!</h2>
          <p>Your order <strong>#${order.orderNumber}</strong> has been processed successfully.</p>
          <p>Please find your invoice attached to this email.</p>
          <br>
          <p>Best regards,<br>BENEKI Team</p>
        </div>
      `,
      attachments: [
        {
          content: pdfBuffer.toString("base64"),
          filename: `invoice-${order.orderNumber}.pdf`,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    };

    console.log('📤 Sending email via SendGrid...');
    await sgMail.send(msg);
    console.log('✅ Email sent successfully to:', toEmail);
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
};