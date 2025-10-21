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

const { createCoreController } = require("@strapi/strapi").factories;
const { PDFService } = require("../services/pdfService");
const sendInvoiceEmail = require("../utils/sendInvoiceEmail");
const fs = require("fs");
const path = require("path");

// Add request tracking to prevent duplicates
const pendingRequests = new Map();

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async sendInvoice(ctx) {
    console.log('🎯 SEND INVOICE ENDPOINT HIT!');
    console.log('📝 Method:', ctx.method);
    console.log('🔗 URL:', ctx.url);
    console.log('📦 Request Body:', ctx.request.body);
    
    // ✅ Handle CORS preflight requests
    if (ctx.method === 'OPTIONS') {
      ctx.set('Access-Control-Allow-Origin', '*');
      ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return ctx.send({}, 204);
    }

    try {
      const { orderId, userId } = ctx.request.body;
      console.log('📨 Received orderId:', orderId, 'userId:', userId);

      // ✅ Validate required fields
      if (!orderId || !userId) {
        console.log('❌ Missing orderId or userId');
        return ctx.badRequest("Missing orderId or userId");
      }

      // ✅ Create request key to prevent duplicate processing
      const requestKey = `${orderId}-${userId}`;
      if (pendingRequests.has(requestKey)) {
        console.log('🔄 Request already in progress, returning existing promise');
        return await pendingRequests.get(requestKey);
      }

      // ✅ Create promise for this request
      const requestPromise = this.processInvoiceRequest(orderId, userId, ctx);
      pendingRequests.set(requestKey, requestPromise);

      try {
        const result = await requestPromise;
        return result;
      } finally {
        // ✅ Clean up request tracking
        pendingRequests.delete(requestKey);
      }

    } catch (err) {
      console.error("💥 ERROR IN SEND INVOICE:");
      console.error("Error details:", err);
      console.error("Error stack:", err.stack);
      return ctx.internalServerError("Failed to send invoice: " + err.message);
    }
  },

  async processInvoiceRequest(orderId, userId, ctx) {
    console.log('🔍 Fetching order from database...');
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
      console.log('❌ Order not found for documentId:', orderId);
      return ctx.notFound("Order not found");
    }
    console.log('✅ Order found:', order.id);

    console.log('🔍 Fetching user from database...');
    const user = await strapi.db.query("plugin::users-permissions.user").findOne({
      where: { id: userId },
    });

    if (!user) {
      console.log('❌ User not found for id:', userId);
      return ctx.notFound("User not found");
    }
    console.log('✅ User found:', user.email);

    // ✅ Validate order has required data
    if (!order.subTotal || !order.total) {
      console.log('❌ Order missing financial data:', {
        subTotal: order.subTotal,
        total: order.total
      });
      return ctx.badRequest("Order missing financial data");
    }

    console.log('🔄 Transforming order data...');
    const invoiceData = this.transformOrderToInvoiceFormat(order, user);
    console.log('✅ Transformed invoice number:', invoiceData.invoiceNumber);

    console.log('📄 Generating PDF...');
    const tmpDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmpDir)) {
      console.log('📁 Creating tmp directory...');
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const pdfPath = path.join(tmpDir, `invoice-${order.id}.pdf`);
    console.log('📁 PDF path:', pdfPath);
    
    try {
      await PDFService.generateAndSaveInvoice(invoiceData, pdfPath);
      console.log('✅ PDF generated successfully');

      console.log('📧 Sending email to:', user.email);
      await sendInvoiceEmail(user.email, order, pdfPath);
      console.log('✅ Email sent successfully');

      console.log('🧹 Cleaning up PDF file...');
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }

      console.log('🎉 INVOICE PROCESS COMPLETED SUCCESSFULLY');
      return ctx.send({ 
        success: true, 
        message: "Invoice sent successfully",
        invoiceNumber: invoiceData.invoiceNumber
      });

    } catch (pdfError) {
      console.error('❌ PDF/Email processing error:', pdfError);
      // Clean up PDF file if it exists
      if (fs.existsSync(pdfPath)) {
        try {
          fs.unlinkSync(pdfPath);
        } catch (cleanupError) {
          console.error('❌ Error cleaning up PDF:', cleanupError);
        }
      }
      throw pdfError;
    }
  },

  transformOrderToInvoiceFormat(order, user) {
    const totalExclVatNum = parseFloat(order.subTotal) || 0;
    const totalVatNum = parseFloat(order.vat) || 0;
    const grandTotalNum = parseFloat(order.total) || 0;

    console.log("💰 Order Totals:", { 
      subTotal: totalExclVatNum, 
      vat: totalVatNum, 
      total: grandTotalNum 
    });

    // ✅ Handle empty products array
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

    const userFirstName = user.firstName || user.firstname || "";
    const userLastName = user.name || user.lastname || "";
    const fullName = `${userFirstName} ${userLastName}`.trim() || user.username || "Customer";

    const shippingAddress = order.shipping_address || order.shippingAddress || {};
    const billingAddress = order.billing_address || order.billingAddress || {};

    console.log("🏠 Address Data:", {
      shipping: shippingAddress,
      billing: billingAddress
    });

    const userAddress = this.extractUserAddress(user);

    const invoiceData = {
      id: order.id,
      documentId: order.documentId,
      invoiceNumber: order.orderNumber || `ORD-${String(order.id).padStart(7, '0')}`,
      invoiceDate: new Date(order.createdAt || new Date()).toLocaleDateString('en-US'),
      
      customerCompany: user.accountType === 'Business' ? user.businessName : fullName,
      customerAddress: this.extractAddress(billingAddress) || userAddress || "Address not provided",
      customerCity: billingAddress.city || this.extractCity(billingAddress) || user.businessRegistrationCountry || "N/A", 
      customerCountry: billingAddress.country || user.businessRegistrationCountry || "France",
      customerVAT: user.vatNumber || "N/A",
      
      clientRef: user.documentId || "N/A",
      clientEmail: user.email,
      
      deliveryName: fullName,
      deliveryAddress: this.extractAddress(shippingAddress) || this.extractAddress(billingAddress) || userAddress || "Address not provided",
      deliveryPhone: shippingAddress.phone || user.phone || "N/A",
      deliveryNote: order.notes || "",
      
      products: products,
      
      paymentMethod: order.paymentMethod || "paypal",
      paymentData: [
        {
          paymentType: order.paymentMethod || "paypal", 
          amount: this.formatCurrency(grandTotalNum)
        }
      ],
      
      bankDetails: {
        iban: "FR76 3000 4000 0100 1234 5678 900",
        bic: "BNPAFRPP"
      },
      
      totalExclVat: this.formatCurrency(totalExclVatNum),
      totalVat: this.formatCurrency(totalVatNum),
      grandTotal: this.formatCurrency(grandTotalNum),
      
      vatBreakdown: [{
        rate: totalExclVatNum > 0 ? `${Math.round((totalVatNum / totalExclVatNum) * 100)}%` : "20%",
        base: this.formatCurrency(totalExclVatNum),
        total: this.formatCurrency(totalVatNum)
      }]
    };

    return invoiceData;
  },

  extractAddress(address) {
    if (!address || Object.keys(address).length === 0) return null;
    
    if (typeof address === 'string') return address;
    
    if (address.address) return address.address;
    if (address.street) return address.street;
    if (address.address_line1) return address.address_line1;
    if (address.address_line_1) return address.address_line_1;
    if (address.line1) return address.line1;
    
    return null;
  },

  extractCity(address) {
    if (!address || Object.keys(address).length === 0) return null;
    
    if (typeof address === 'string') return address;
    
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

  extractUserAddress(user) {
    if (user.address) return user.address;
    if (user.street) return user.street;
    if (user.location) return user.location;
    
    const addressParts = [];
    if (user.address_line1) addressParts.push(user.address_line1);
    if (user.city) addressParts.push(user.city);
    if (user.postalCode) addressParts.push(user.postalCode);
    
    return addressParts.length > 0 ? addressParts.join(', ') : null;
  },

  formatCurrency(amount) {
    if (typeof amount === 'string') {
      const num = parseFloat(amount);
      if (isNaN(num)) return '0.00 €';
      amount = num;
    }
    
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