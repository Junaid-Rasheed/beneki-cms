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

      // ✅ Fetch order and user info from DB with all necessary relations
      const order = await strapi.db.query("api::order.order").findOne({
        where: { documentId: orderId },
        populate: { 
          items: true, 
          user: true,
          shipping_address: true,
          billing_address: true,
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
    const totalExclVatNum = order.subTotal || 0;
    const totalVatNum = order.vat || 0;
    const grandTotalNum = order.total || 0;

    console.log("Using order totals:", { totalExclVatNum, totalVatNum, grandTotalNum });

    // Create product entry from actual order data
    const products = [];
    if (totalExclVatNum > 0) {
      products.push({
        reference: "ORDER-" + (order.documentId || order.id),
        name: "Order Products",
        qty: 1,
        unitPrice: this.formatCurrency(totalExclVatNum),
        totalExclVat: this.formatCurrency(totalExclVatNum),
        vatRate: totalExclVatNum > 0 ? Math.round((totalVatNum / totalExclVatNum) * 100) : 20
      });
    }

    // Get user names dynamically
    const userFirstName = user.firstName || user.firstname || "";
    const userLastName = user.name || user.lastname || "";
    const fullName = `${userFirstName} ${userLastName}`.trim() || user.username || "Customer";

    // Get addresses dynamically - check all possible address fields
    const shippingAddress = order.shipping_address || order.shippingAddress || {};
    const billingAddress = order.billing_address || order.billingAddress || {};

    console.log("Shipping Address:", shippingAddress);
    console.log("Billing Address:", billingAddress);

    // Build the invoice data object with dynamic data
    const invoiceData = {
      id: order.id,
      documentId: order.documentId,
      // FIX: Use orderNumber directly instead of documentId
      invoiceNumber: order.orderNumber || `ORD-${String(order.id).padStart(7, '0')}`,
      invoiceDate: new Date(order.createdAt).toLocaleDateString('en-US'),
      
      // Customer Information - Use billing address or user info
      customerCompany: user.accountType === 'Business' ? user.businessName : fullName,
      customerAddress: this.getAddressLine(billingAddress, 1),
      customerCity: billingAddress.city || this.getAddressLine(billingAddress, 2) || "N/A", 
      customerCountry: billingAddress.country || "N/A",
      customerVAT: user.vatNumber || "N/A",
      
      // Client Reference - Dynamic
      clientRef: user.documentId || "N/A",
      clientEmail: user.email,
      
      // Delivery Information - Use shipping address or fallback to billing address
      deliveryName: shippingAddress.full_name || shippingAddress.name || fullName,
      deliveryAddress: this.getAddressLine(shippingAddress, 1) || this.getAddressLine(billingAddress, 1) || "N/A",
      deliveryPhone: shippingAddress.phone || user.phone || "N/A",
      deliveryNote: order.delivery_notes || order.notes || "",
      
      // Products - Dynamic
      products: products,
      
      // Payment Information - Dynamic
      paymentMethod: order.paymentMethod || "paypal",
      paymentData: [
        {
          paymentType: order.paymentMethod || "paypal", 
          amount: this.formatCurrency(grandTotalNum)
        }
      ],
      
      // Bank Details
      bankDetails: {
        iban: "FR76 3000 4000 0100 1234 5678 900",
        bic: "BNPAFRPP"
      },
      
      // Use the actual order totals
      totalExclVat: this.formatCurrency(totalExclVatNum),
      totalVat: this.formatCurrency(totalVatNum),
      grandTotal: this.formatCurrency(grandTotalNum),
      
      // VAT Breakdown - Dynamic
      vatBreakdown: [{
        rate: totalExclVatNum > 0 ? `${Math.round((totalVatNum / totalExclVatNum) * 100)}%` : "20%",
        base: this.formatCurrency(totalExclVatNum),
        total: this.formatCurrency(totalVatNum)
      }]
    };

    return invoiceData;
  },

  // Helper function to extract address lines from different field structures
  getAddressLine(address, lineNumber) {
    if (!address) return null;
    
    // Try different field naming conventions
    if (lineNumber === 1) {
      return address.address_line1 || address.address_line_1 || address.street || address.address || null;
    } else if (lineNumber === 2) {
      const cityPart = address.city || '';
      const postalPart = address.postalCode || address.postal_code || '';
      if (cityPart && postalPart) {
        return `${postalPart} ${cityPart}`;
      }
      return cityPart || postalPart || address.address_line2 || address.address_line_2 || null;
    }
    
    return null;
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

// Add this right after fetching the order
console.log("ORDER ADDRESSES:", {
  shipping_address: order.shipping_address,
  billing_address: order.billing_address,
  shippingAddress: order.shippingAddress,
  billingAddress: order.billingAddress
});