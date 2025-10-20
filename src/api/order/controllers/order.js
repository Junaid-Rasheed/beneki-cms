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
          company: true,
          bank_details: true
        },
      });

      if (!order) {
        return ctx.notFound("Order not found");
      }

      const user = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { id: userId },
        populate: ['address', 'company']
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

    // Get addresses dynamically - check multiple possible field names
    const shippingAddress = order.shipping_address || order.shippingAddress || user.shipping_address || {};
    const billingAddress = order.billing_address || order.billingAddress || user.billing_address || user.address || {};
    const company = order.company || user.company || {};

    // Get bank details dynamically
    const bankDetails = order.bank_details || order.bankDetails || company.bank_details || {};

    // Build the invoice data object with dynamic data
    const invoiceData = {
      id: order.id,
      documentId: order.documentId,
      invoiceNumber: order.orderNumber || `ORD-${String(order.documentId).padStart(7, '0')}`,
      invoiceDate: new Date(order.createdAt).toLocaleDateString('en-US'),
      
      // Customer Information - Dynamic from company or user
      customerCompany: company.name || user.companyName || (user.accountType === 'Business' ? user.businessName : fullName),
      customerAddress: this.formatAddress(billingAddress),
      customerCity: billingAddress.city || company.city || "N/A", 
      customerCountry: billingAddress.country || company.country || user.businessRegistrationCountry || "N/A",
      customerVAT: company.vatNumber || user.vatNumber || "N/A",
      
      // Client Reference - Dynamic
      clientRef: user.customerCode || user.documentId || "N/A",
      clientEmail: user.email,
      
      // Delivery Information - Dynamic from shipping address
      deliveryName: shippingAddress.full_name || shippingAddress.name || fullName,
      deliveryAddress: this.formatAddress(shippingAddress),
      deliveryPhone: shippingAddress.phone || user.phone || "N/A",
      deliveryNote: order.delivery_notes || order.notes || shippingAddress.notes || "",
      
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
      
      // Bank Details - Dynamic from company or order
      bankDetails: {
        iban: bankDetails.iban || company.iban || "FR76 3000 4000 0100 1234 5678 900",
        bic: bankDetails.bic || company.bic || "BNPAFRPP",
        bankName: bankDetails.bankName || company.bankName || "BNP PARIBAS",
        accountHolder: bankDetails.accountHolder || company.name || "BENEKI"
      },
      
      // Company Legal Information - Dynamic
      companyLegal: {
        capital: company.capital || "150 000€",
        vatNumber: company.vatNumber || "FR61889408019",
        siret: company.siret || "88940801900020",
        ape: company.ape || "4690Z"
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

  // Helper function to format address from different field structures
  formatAddress(address) {
    if (!address) return "N/A";
    
    if (address.street && address.city && address.postalCode) {
      return `${address.street}, ${address.postalCode} ${address.city}`;
    } else if (address.address_line1) {
      const line2 = address.address_line2 ? `, ${address.address_line2}` : '';
      return `${address.address_line1}${line2}, ${address.postal_code || ''} ${address.city || ''}`.trim();
    } else if (address.address) {
      return address.address;
    } else if (address.street) {
      return address.street;
    }
    
    return "N/A";
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