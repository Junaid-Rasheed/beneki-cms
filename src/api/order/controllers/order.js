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
    console.log("Original order items:", order.items);
    
    // Calculate products from order items - FIXED
    const products = (order.items || []).map(item => {
      const quantity = item.quantity || 1;
      const unitPrice = item.price || item.unitPrice || 0;
      const totalExclVat = quantity * unitPrice;
      const vatRate = item.vatRate || item.taxRate || 20;
      
      return {
        reference: item.sku || item.productId || item.reference || `ITEM-${item.id}`,
        name: item.name || item.title || "Product",
        qty: quantity,
        unitPrice: this.formatCurrency(unitPrice),
        totalExclVat: this.formatCurrency(totalExclVat),
        vatRate: vatRate
      };
    });

    console.log("Transformed products:", products);

    // Calculate totals - FIXED
    const totalExclVatNum = products.reduce((sum, product) => {
      const quantity = product.qty || 1;
      const unitPrice = parseFloat(String(product.unitPrice).replace('€', '').replace(',', '.').trim()) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
    
    const totalVatNum = products.reduce((sum, product) => {
      const quantity = product.qty || 1;
      const unitPrice = parseFloat(String(product.unitPrice).replace('€', '').replace(',', '.').trim()) || 0;
      const vatRate = product.vatRate || 20;
      const productTotal = quantity * unitPrice;
      return sum + (productTotal * (vatRate / 100));
    }, 0);
    
    const grandTotalNum = totalExclVatNum + totalVatNum;

    console.log("Calculated totals:", { totalExclVatNum, totalVatNum, grandTotalNum });

    // Get addresses - FIXED field access
    const shippingAddress = order.shipping_address || order.shippingAddress || {};
    const billingAddress = order.billing_address || order.billingAddress || {};
    
    // Get user names - FIXED
    const userFirstName = user.firstname || user.firstName || user.name || "";
    const userLastName = user.lastname || user.lastName || "";
    const fullName = `${userFirstName} ${userLastName}`.trim() || "N/A";

    // Build the invoice data object matching the PDF expected format
    const invoiceData = {
      id: order.id,
      documentId: order.documentId,
      invoiceNumber: order.invoiceNumber || `ORD-${String(order.documentId).padStart(7, '0')}`,
      invoiceDate: order.invoiceDate || new Date(order.createdAt || order.created_at).toLocaleDateString('en-US'),
      
      // Customer Information - FIXED
      customerCompany: order.companyName || user.company || billingAddress.company || "N/A",
      customerAddress: billingAddress.address_line1 || billingAddress.address_line_1 || billingAddress.street || billingAddress.address || "N/A",
      customerCity: billingAddress.city || "N/A", 
      customerCountry: billingAddress.country || "N/A",
      customerVAT: order.vatNumber || user.vatNumber || "N/A",
      
      // Client Reference
      clientRef: order.clientReference || user.customerId || "N/A",
      clientEmail: user.email,
      
      // Delivery Information - FIXED
      deliveryName: shippingAddress.full_name || shippingAddress.name || fullName,
      deliveryAddress: shippingAddress.address_line1 || shippingAddress.address_line_1 || shippingAddress.street || shippingAddress.address || "N/A",
      deliveryPhone: shippingAddress.phone || user.phone || "N/A",
      deliveryNote: order.delivery_note || shippingAddress.note || "",
      
      // Products
      products: products,
      
      // Payment Information
      paymentMethod: order.paymentMethod || order.payment_method || "Credit Card",
      paymentData: [
        {
          paymentType: order.paymentMethod || order.payment_method || "Credit Card", 
          amount: this.formatCurrency(grandTotalNum)
        }
      ],
      
      // Bank Details
      bankDetails: {
        iban: order.bankIban || "FR76 3000 4000 0100 1234 5678 900",
        bic: order.bankBic || "BNPAFRPP"
      },
      
      // Calculated Totals
      totalExclVat: this.formatCurrency(totalExclVatNum),
      totalVat: this.formatCurrency(totalVatNum),
      grandTotal: this.formatCurrency(grandTotalNum),
      
      // VAT Breakdown
      vatBreakdown: this.calculateVatBreakdown(products),
      
      // Include original data for fallback
      ...order
    };

    return invoiceData;
  },

  // Calculate VAT breakdown from products - FIXED
  calculateVatBreakdown(products) {
    const vatRates = {};
    
    products.forEach(product => {
      const rate = product.vatRate || 20;
      const quantity = product.qty || 1;
      const unitPrice = parseFloat(String(product.unitPrice).replace('€', '').replace(',', '.').trim()) || 0;
      const base = quantity * unitPrice;
      const vatAmount = base * (rate / 100);
      
      if (!vatRates[rate]) {
        vatRates[rate] = { base: 0, total: 0 };
      }
      
      vatRates[rate].base += base;
      vatRates[rate].total += vatAmount;
    });

    return Object.entries(vatRates).map(([rate, amounts]) => ({
      rate: `${parseFloat(rate).toFixed(2)}%`,
      base: this.formatCurrency(amounts.base),
      total: this.formatCurrency(amounts.total)
    }));
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