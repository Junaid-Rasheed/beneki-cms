// 'use strict';

// /**
//  * order service
//  */

// const { createCoreService } = require('@strapi/strapi').factories;

// module.exports = createCoreService('api::order.order');


'use strict';

const { PDFService } = require('../services/pdfService');
const sendInvoiceEmail = require('../utils/sendInvoiceEmail');

module.exports = ({ strapi }) => ({
  async sendInvoice(ctx) {
    try {
      const { orderId, userId } = ctx.request.body;
      
      console.log('🔄 Starting invoice generation for order:', orderId);

      // 1. Fetch order data from database - ADD THIS
      const order = await strapi.entityService.findOne('api::order.order', orderId, {
        populate: ['user', 'order_items', 'payment', 'address'],
      });

      if (!order) {
        return ctx.notFound('Order not found');
      }

      // 2. Transform to invoice format - ADD THIS
      const invoiceData = {
        invoiceNumber: order.invoice_number || `ORD-${order.id.toString().padStart(7, '0')}`,
        invoiceDate: new Date(order.createdAt).toLocaleDateString(),
        clientRef: order.id.toString(),
        clientEmail: order.user?.email || order.email,
        customerVAT: order.vat_number || 'N/A',
        
        customerCompany: order.billing_company || 'N/A',
        customerAddress: order.billing_address || 'N/A', 
        customerCity: order.billing_city || 'N/A',
        customerCountry: order.billing_country || 'N/A',
        
        deliveryName: order.shipping_name || 'N/A',
        deliveryAddress: order.shipping_address || 'N/A',
        deliveryPhone: order.shipping_phone || 'N/A',
        deliveryNote: order.shipping_notes || '',
        
        // Use your existing sample data structure but with real order data
        products: order.order_items?.map(item => ({
          reference: item.product_sku || 'N/A',
          name: item.product_name,
          qty: item.quantity,
          unitPrice: `${item.unit_price} €`,
          totalExclVat: `${item.total_excl_vat} €`,
          vatRate: item.vat_rate
        })) || [],
        
        // Calculate VAT or use your existing structure
        vatBreakdown: order.vat_breakdown || [],
        
        totalExclVat: `${order.total_excl_vat} €`,
        totalVat: `${order.total_vat} €`, 
        grandTotal: `${order.total} €`,
        
        bankDetails: {
          iban: 'FR76 3000 4013 8200 0100 7237 994',
          bic: 'BNPAFRPPXXX'
        }
      };

      // 3. Generate PDF - KEEP YOUR EXISTING PDFService call
      const pdfBuffer = await PDFService.generateInvoicePDF(invoiceData);
      
      // 4. Save PDF temporarily - ADD THIS
      const fs = require('fs').promises;
      const tempDir = './temp';
      await fs.mkdir(tempDir, { recursive: true });
      const pdfPath = `${tempDir}/invoice-${invoiceData.invoiceNumber}.pdf`;
      await fs.writeFile(pdfPath, pdfBuffer);

      // 5. Send email - KEEP YOUR EXISTING email function
      const userEmail = order.user?.email || order.email;
      await sendInvoiceEmail(userEmail, order, pdfPath);

      // 6. Clean up - ADD THIS
      await fs.unlink(pdfPath);

      // 7. Update order status - ADD THIS
      await strapi.entityService.update('api::order.order', orderId, {
        data: {
          invoice_sent: true,
          invoice_sent_at: new Date(),
        },
      });

      console.log('✅ Invoice sent successfully to:', userEmail);
      
      return {
        success: true,
        message: 'Invoice sent successfully',
        orderId: orderId
      };

    } catch (error) {
      console.error('❌ Invoice error:', error);
      return ctx.badRequest('Failed to send invoice: ' + error.message);
    }
  }
});