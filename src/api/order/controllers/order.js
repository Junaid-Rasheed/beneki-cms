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
      console.log("USERTWESS", user);

      // ✅ Transform Strapi data to match PDF expected format
      const invoiceData = this.transformOrderToInvoiceFormat(order, user);

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

  // Helper function to transform Strapi order data to PDF format
  transformOrderToInvoiceFormat(order, user) {
    // Calculate totals from items
    const products = order.items?.map(item => ({
      reference: item.sku || item.productId || `ITEM-${item.id}`,
      name: item.name || item.title || "Product",
      quantity: item.quantity || 1,
      price: item.price || item.unitPrice || 0,
      vatRate: item.vatRate || item.taxRate || 20,
      totalExclVat: (item.quantity || 1) * (item.price || item.unitPrice || 0)
    })) || [];

    const totalExclVat = products.reduce((sum, product) => sum + product.totalExclVat, 0);
    const totalVat = products.reduce((sum, product) => {
      return sum + (product.totalExclVat * (product.vatRate / 100));
    }, 0);
    const grandTotal = totalExclVat + totalVat;

    // Get addresses - adjust field names based on your Strapi schema
    const shippingAddress = order.shipping_address || order.shippingAddress || {};
    const billingAddress = order.billing_address || order.billingAddress || {};

    return {
      id: order.id,
      documentId: order.documentId,
      invoiceNumber: order.invoiceNumber || `ORD-${String(order.documentId).padStart(7, '0')}`,
      invoiceDate: order.invoiceDate || new Date(order.createdAt || order.created_at).toLocaleDateString('en-US'),
      
      // Customer Information
      customerCompany: order.companyName || user.company || billingAddress.company || "N/A",
      customerAddress: billingAddress.address_line_1 || billingAddress.street || billingAddress.address || "N/A",
      customerCity: billingAddress.city || "N/A",
      customerCountry: billingAddress.country || "N/A",
      customerVAT: order.vatNumber || user.vatNumber || "N/A",
      
      // Client Reference
      clientRef: order.clientReference || user.customerId || "N/A",
      clientEmail: user.email,
      
      // Delivery Information
      deliveryName: shippingAddress.full_name || shippingAddress.name || `${user.firstname} ${user.lastname}`.trim() || "N/A",
      deliveryAddress: shippingAddress.address_line_1 || shippingAddress.street || shippingAddress.address || "N/A",
      deliveryPhone: shippingAddress.phone || user.phone || "N/A",
      deliveryNote: order.delivery_note || shippingAddress.note || "",
      
      // Products
      products: products,
      
      // Payment Information
      paymentMethod: order.paymentMethod || order.payment_method || "Credit Card",
      paymentData: [
        {
          paymentType: order.paymentMethod || order.payment_method || "Credit Card",
          amount: grandTotal.toFixed(2) + ' €'
        }
      ],
      
      // Bank Details
      bankDetails: {
        iban: order.bankIban || "FR76 3000 4000 0100 1234 5678 900",
        bic: order.bankBic || "BNPAFRPP"
      },
      
      // Calculated Totals
      totalExclVat: totalExclVat,
      totalVat: totalVat,
      grandTotal: grandTotal,
      
      // VAT Breakdown (calculated from products)
      vatBreakdown: this.calculateVatBreakdown(products),
      
      // User reference for fallbacks
      user: user
    };
  },

  // Calculate VAT breakdown from products
  calculateVatBreakdown(products) {
    const vatRates = {};
    
    products.forEach(product => {
      const rate = product.vatRate || 20;
      const base = product.totalExclVat || 0;
      const vatAmount = base * (rate / 100);
      
      if (!vatRates[rate]) {
        vatRates[rate] = { base: 0, total: 0 };
      }
      
      vatRates[rate].base += base;
      vatRates[rate].total += vatAmount;
    });

    return Object.entries(vatRates).map(([rate, amounts]) => ({
      rate: `${parseFloat(rate).toFixed(2)}%`,
      base: amounts.base.toFixed(2) + ' €',
      total: amounts.total.toFixed(2) + ' €'
    }));
  }
}));
