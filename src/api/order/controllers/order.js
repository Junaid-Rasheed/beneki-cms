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
// src/api/order/controllers/order.js - UPDATED FOR AUTH
"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const { PDFService } = require("../services/pdfService");
const sendInvoiceEmail = require("../utils/sendInvoiceEmail");
const fs = require("fs");
const path = require("path");

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async sendInvoice(ctx) {
    console.log('=== SEND INVOICE ENDPOINT CALLED ===');
    console.log('Authenticated user:', ctx.state.user);
    console.log('Request body:', ctx.request.body);
    
    try {
      // Get authenticated user from context
      const authenticatedUser = ctx.state.user;
      
      if (!authenticatedUser) {
        console.log('No authenticated user found');
        return ctx.unauthorized("You must be logged in to send invoices");
      }

      const { orderId } = ctx.request.body;
      console.log('Received orderId:', orderId);

      if (!orderId) {
        console.log('Missing orderId');
        return ctx.badRequest("Missing orderId");
      }

      console.log('Fetching order from database...');
      // ✅ Fetch order from DB
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
        console.log('Order not found for documentId:', orderId);
        return ctx.notFound("Order not found");
      }
      console.log('Order found:', order.id);

      // Verify the order belongs to the authenticated user
      if (order.user && order.user.id !== authenticatedUser.id) {
        console.log('User does not have permission for this order');
        console.log('Order user ID:', order.user?.id, 'Authenticated user ID:', authenticatedUser.id);
        return ctx.forbidden("You don't have permission to access this order");
      }

      // ✅ Transform Strapi data to match PDF expected format
      console.log('Transforming order data...');
      const invoiceData = this.transformOrderToInvoiceFormat(order, authenticatedUser);
      console.log('Transformed invoice number:', invoiceData.invoiceNumber);

      // ✅ Generate PDF file using shared React-PDF component
      console.log('Generating PDF...');
      const tmpDir = path.join(process.cwd(), "tmp");
      if (!fs.existsSync(tmpDir)) {
        console.log('Creating tmp directory...');
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const pdfPath = path.join(tmpDir, `invoice-${order.id}.pdf`);
      console.log('PDF path:', pdfPath);
      
      await PDFService.generateAndSaveInvoice(invoiceData, pdfPath);
      console.log('PDF generated successfully');

      // ✅ Send email with attachment
      console.log('Sending email to:', authenticatedUser.email);
      await sendInvoiceEmail(authenticatedUser.email, order, pdfPath);
      console.log('Email sent successfully');

      // ✅ Clean up PDF file
      console.log('Cleaning up PDF file...');
      fs.unlinkSync(pdfPath);

      console.log('=== INVOICE PROCESS COMPLETED SUCCESSFULLY ===');
      return ctx.send({ 
        success: true, 
        message: "Invoice sent successfully",
        invoiceNumber: invoiceData.invoiceNumber
      });

    } catch (err) {
      console.error("=== ERROR IN SEND INVOICE ===");
      console.error("Error details:", err);
      console.error("Error stack:", err.stack);
      return ctx.internalServerError("Failed to send invoice: " + err.message);
    }
  },

  transformOrderToInvoiceFormat(order, user) {
    // Use the actual order totals from your data
    const totalExclVatNum = order.subTotal || 0;
    const totalVatNum = order.vat || 0;
    const grandTotalNum = order.total || 0;

    console.log("Order Totals:", { 
      subTotal: totalExclVatNum, 
      vat: totalVatNum, 
      total: grandTotalNum 
    });

    // Create product entry from actual order data
    const products = [];
    if (totalExclVatNum > 0) {
      products.push({
        reference: "PROD-001",
        name: "Web Hosting Service",
        qty: 1,
        unitPrice: this.formatCurrency(totalExclVatNum),
        totalExclVat: this.formatCurrency(totalExclVatNum),
        vatRate: totalExclVatNum > 0 ? Math.round((totalVatNum / totalExclVatNum) * 100) : 20
      });
    }

    // Get user names from authenticated user
    const userFirstName = user.firstName || user.firstname || "";
    const userLastName = user.name || user.lastname || "";
    const fullName = `${userFirstName} ${userLastName}`.trim() || user.username || "Customer";

    // Get addresses from order or user
    const shippingAddress = order.shipping_address || order.shippingAddress || {};
    const billingAddress = order.billing_address || order.billingAddress || {};

    console.log("Address Data:", {
      shipping: shippingAddress,
      billing: billingAddress
    });

    // Build the invoice data object
    const invoiceData = {
      id: order.id,
      documentId: order.documentId,
      invoiceNumber: order.orderNumber || `ORD-${String(order.id).padStart(7, '0')}`,
      invoiceDate: new Date(order.createdAt || new Date()).toLocaleDateString('en-US'),
      
      // Customer Information
      customerCompany: user.accountType === 'Business' ? (user.businessName || fullName) : fullName,
      customerAddress: this.extractAddress(billingAddress) || this.extractUserAddress(user) || "Address not provided",
      customerCity: billingAddress.city || this.extractCity(billingAddress) || (user.businessRegistrationCountry || "N/A"), 
      customerCountry: billingAddress.country || user.businessRegistrationCountry || "France",
      customerVAT: user.vatNumber || "N/A",
      
      // Client Reference
      clientRef: user.documentId || user.id.toString() || "N/A",
      clientEmail: user.email,
      
      // Delivery Information
      deliveryName: fullName,
      deliveryAddress: this.extractAddress(shippingAddress) || this.extractAddress(billingAddress) || this.extractUserAddress(user) || "Address not provided",
      deliveryPhone: shippingAddress.phone || user.phone || "N/A",
      deliveryNote: order.notes || "",
      
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
      
      // Bank Details
      bankDetails: {
        iban: "FR76 3000 4000 0100 1234 5678 900",
        bic: "BNPAFRPP"
      },
      
      // Totals
      totalExclVat: this.formatCurrency(totalExclVatNum),
      totalVat: this.formatCurrency(totalVatNum),
      grandTotal: this.formatCurrency(grandTotalNum),
      
      // VAT Breakdown
      vatBreakdown: [{
        rate: totalExclVatNum > 0 ? `${Math.round((totalVatNum / totalExclVatNum) * 100)}%` : "20%",
        base: this.formatCurrency(totalExclVatNum),
        total: this.formatCurrency(totalVatNum)
      }]
    };

    return invoiceData;
  },

  // Helper function to extract address from different field structures
  extractAddress(address) {
    if (!address || Object.keys(address).length === 0) return null;
    
    // Try different field naming conventions
    if (address.address) return address.address;
    if (address.street) return address.street;
    if (address.address_line1) return address.address_line1;
    if (address.address_line_1) return address.address_line_1;
    if (address.line1) return address.line1;
    
    return null;
  },

  // Helper function to extract city information
  extractCity(address) {
    if (!address || Object.keys(address).length === 0) return null;
    
    if (address.city && address.postalCode) {
      return `${address.postalCode} ${address.city}`;
    }
    if (address.city && address.postal_code) {
      return `${address.postal_code} ${address.city}`;
    }
    if (address.city) return address.city;
    if (address.postalCode) return address.postalCode;
    if (address.postal_code) return address.postal_code;
    
    return null;
  },

  // Extract address from user fields as fallback
  extractUserAddress(user) {
    if (user.address) return user.address;
    if (user.street) return user.street;
    if (user.location) return user.location;
    
    // Check if user has any address-related fields
    const addressParts = [];
    if (user.address_line1) addressParts.push(user.address_line1);
    if (user.city) addressParts.push(user.city);
    if (user.postalCode) addressParts.push(user.postalCode);
    
    return addressParts.length > 0 ? addressParts.join(', ') : null;
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