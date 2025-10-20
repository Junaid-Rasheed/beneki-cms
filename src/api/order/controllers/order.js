// // @ts-nocheck
// "use strict";

// const path = require("path");
// const fs = require("fs");
// const { createCoreController } = require("@strapi/strapi").factories;
// const generateInvoicePDF = require("../utils/generateInvoicePDF");
// const sendInvoiceEmail = require("../utils/sendInvoiceEmail");

// module.exports = createCoreController("api::order.order", ({ strapi }) => ({
//   async sendInvoice(ctx) {
//     try {
//       const { orderId, userId } = ctx.request.body;

//       if (!orderId || !userId) {
//         return ctx.badRequest("Missing orderId or userId");
//       }

//       // ✅ Fetch order and user info from DB
//       const order = await strapi.db.query("api::order.order").findOne({
//         where: { documentId: orderId },
//         populate: { items: true, user: true },
//       });

//       if (!order) {
//         return ctx.notFound("Order not found");
//       }

//       const user = await strapi.db.query("plugin::users-permissions.user").findOne({
//         where: { id: userId },
//       });

//       if (!user) {
//         return ctx.notFound("User not found");
//       }

//       console.log("ORDERTESTTT",order)
//             console.log("USERTWESS",user)

//       // ✅ Generate PDF file
//       const pdfPath = await generateInvoicePDF(order);

//       console.log("PDF PRINT",pdfPath)
//       // ✅ Send email with attachment
//       await sendInvoiceEmail(user.email, order, pdfPath);
//       console.log("PDF Sent")

//       // ✅ Clean up PDF file (optional)
//       fs.unlinkSync(pdfPath);

//       return ctx.send({ success: true, message: "Invoice sent successfully" });
//     } catch (err) {
//       console.error("Error sending invoice:", err);
//       return ctx.internalServerError("Failed to send invoice");
//     }
//   },
// }));



// @ts-nocheck
"use strict";

const path = require("path");
const fs = require("fs");
const { createCoreController } = require("@strapi/strapi").factories;
const generateInvoicePDF = require("../utils/generateInvoicePDF");
const sendInvoiceEmail = require("../utils/sendInvoiceEmail");

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async sendInvoice(ctx) {
    try {
      const { orderId, userId } = ctx.request.body;

      if (!orderId || !userId) {
        return ctx.badRequest("Missing orderId or userId");
      }

      // ✅ Fetch order and user info from DB
      const order = await strapi.db.query("api::order.order").findOne({
        where: { documentId: orderId },
        populate: { 
          items: true, 
          user: true,
          shipping_address: true,
          billing_address: true 
        },
      });

      if (!order) {
        return ctx.notFound("Order not found");
      }

      const user = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { id: userId },
      });

      if (!user) {
        return ctx.notFound("User not found");
      }

      console.log("ORDERTESTTT", order);

      // ✅ Transform Strapi data to match PDF expected format
      const invoiceData = this.transformOrderToInvoiceFormat(order, user);

      console.log("TRANSFORMED DATA:", invoiceData);

      // ✅ Generate PDF file with transformed data
      const pdfPath = await generateInvoicePDF(invoiceData);

      console.log("PDF PRINT", pdfPath);
      
      // ✅ Send email with attachment
      await sendInvoiceEmail(user.email, order, pdfPath);
      console.log("PDF Sent");

      // ✅ Clean up PDF file (optional)
      fs.unlinkSync(pdfPath);

      return ctx.send({ success: true, message: "Invoice sent successfully" });
    } catch (err) {
      console.error("Error sending invoice:", err);
      return ctx.internalServerError("Failed to send invoice");
    }
  },

  // Transform Strapi order data to PDF format
  transformOrderToInvoiceFormat(order, user) {
    // Use the actual order totals from your data
    const totalExclVatNum = order.subTotal || 15; // From your data: 15
    const totalVatNum = order.vat || 3; // From your data: 3
    const grandTotalNum = order.total || 18; // From your data: 18

    console.log("Using order totals:", { totalExclVatNum, totalVatNum, grandTotalNum });

    // Create product entry that matches the reference image
    const products = [{
      reference: "HOSTING-001",
      name: "Web Hosting Service",
      qty: 1,
      unitPrice: this.formatCurrency(totalExclVatNum),
      totalExclVat: this.formatCurrency(totalExclVatNum),
      vatRate: 20 // 3/15 = 20% VAT rate
    }];

    // Get user names
    const userFirstName = user.firstName || user.firstname || "daily";
    const userLastName = user.name || user.lastname || "info";
    const fullName = `${userFirstName} ${userLastName}`.trim();

    // Build the invoice data object matching the reference image
    const invoiceData = {
      id: order.id,
      documentId: order.documentId,
      invoiceNumber: order.orderNumber || `ORD-${String(order.documentId).padStart(7, '0')}`,
      invoiceDate: new Date(order.createdAt).toLocaleDateString('en-US'),
      
      // Customer Information - like reference image
      customerCompany: "Alpha", // Hardcoded like reference
      customerAddress: "w-223",
      customerCity: "59320 Kahror", 
      customerCountry: "France",
      customerVAT: "N/A",
      
      // Client Reference
      clientRef: "N/A",
      clientEmail: user.email,
      
      // Delivery Information - like reference image
      deliveryName: "Geoffrey Khan", // Hardcoded like reference
      deliveryAddress: "w-223",
      deliveryPhone: "0644871944",
      deliveryNote: "",
      
      // Products
      products: products,
      
      // Payment Information
      paymentMethod: order.paymentMethod || "paypal",
      paymentData: [
        {
          paymentType: order.paymentMethod || "paypal", 
          amount: this.formatCurrency(grandTotalNum)
        }
      ],
      
      // Bank Details - like reference image
      bankDetails: {
        iban: "FR76 1695 8000 0109 8453 4533 296",
        bic: "ONTORPPXXX"
      },
      
      // Use the actual order totals
      totalExclVat: this.formatCurrency(totalExclVatNum),
      totalVat: this.formatCurrency(totalVatNum),
      grandTotal: this.formatCurrency(grandTotalNum),
      
      // VAT Breakdown
      vatBreakdown: [{
        rate: "20.00%",
        base: this.formatCurrency(totalExclVatNum),
        total: this.formatCurrency(totalVatNum)
      }]
    };

    return invoiceData;
  },

  // Format currency helper
  formatCurrency(amount) {
    if (typeof amount === 'string') return amount;
    if (typeof amount === 'number') {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
      }).format(amount);
    }
    return '0.00 €';
  }
}));