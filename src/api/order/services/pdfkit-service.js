"use strict";

const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

class PDFKitService {
  static async generateInvoicePDF(order) {
    return new Promise((resolve, reject) => {
      try {
        console.log('📄 Generating PDF with PDFKit for order:', order.invoiceNumber);
        
        const doc = new PDFDocument({ margin: 30 });
        const chunks = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add content to PDF
        this.buildInvoicePDF(doc, order);
        
        // Finalize PDF
        doc.end();
        
      } catch (error) {
        console.error('❌ PDF generation error:', error);
        reject(error);
      }
    });
  }

  static buildInvoicePDF(doc, order) {
    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
    doc.moveDown(0.5);
    
    // Company Info
    doc.fontSize(10).font('Helvetica')
       .text('BENEKI', 50, 50)
       .text('691 rue Maurice Caullery', 50, 65)
       .text('59500 Douai, FRANCE', 50, 80)
       .text('www.beneki.net | Tel. 03 74 09 81 86', 50, 95);
    
    // Invoice Details
    doc.fontSize(12)
       .text(`Invoice Number: ${order.invoiceNumber}`, 350, 50)
       .text(`Date: ${order.invoiceDate}`, 350, 70)
       .text(`Client Ref: ${order.clientRef}`, 350, 90);
    
    doc.moveDown(4);
    
    // Customer Info
    doc.fontSize(10)
       .text('Bill To:', 50, 150)
       .text(order.customerCompany, 50, 165)
       .text(order.customerAddress, 50, 180)
       .text(`${order.customerCity}, ${order.customerCountry}`, 50, 195)
       .text(`Email: ${order.clientEmail}`, 50, 210)
       .text(`VAT: ${order.customerVAT}`, 50, 225);
    
    // Delivery Info
    doc.text('Deliver To:', 300, 150)
       .text(order.deliveryName, 300, 165)
       .text(order.deliveryAddress, 300, 180)
       .text(`Phone: ${order.deliveryPhone}`, 300, 195);
    
    if (order.deliveryNote) {
      doc.text(`Note: ${order.deliveryNote}`, 300, 210);
    }
    
    doc.moveDown(8);
    
    // Products Table Header
    const tableTop = 280;
    doc.font('Helvetica-Bold')
       .text('Description', 50, tableTop)
       .text('Qty', 300, tableTop)
       .text('Price', 350, tableTop)
       .text('Amount', 450, tableTop);
    
    // Products
    let y = tableTop + 20;
    order.products.forEach((product, index) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      doc.font('Helvetica')
         .text(product.name, 50, y)
         .text(product.qty.toString(), 300, y)
         .text(product.unitPrice, 350, y)
         .text(product.totalExclVat, 450, y);
      
      y += 20;
    });
    
    // Totals
    const totalsY = y + 30;
    doc.font('Helvetica')
       .text(`Subtotal: ${order.totalExclVat}`, 350, totalsY)
       .text(`VAT: ${order.totalVat}`, 350, totalsY + 20)
       .font('Helvetica-Bold')
       .text(`Total: ${order.grandTotal}`, 350, totalsY + 40);
    
    // Footer
    const footerY = 750;
    doc.fontSize(8).font('Helvetica')
       .text('BENEKI SARL / Capital 150 000€ / VAT Number: FR61889408019 / Siret 88940801900020 / APE 4690Z', 
             50, footerY, { align: 'center', width: 500 });
  }

  static async generateAndSaveInvoice(orderData, filePath) {
    try {
      console.log('💾 Saving PDF to:', filePath);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      const pdfBuffer = await this.generateInvoicePDF(orderData);
      await fs.writeFile(filePath, pdfBuffer);
      
      console.log('✅ PDF saved successfully, size:', pdfBuffer.length, 'bytes');
      return filePath;
    } catch (error) {
      console.error('❌ Error saving PDF:', error);
      throw error;
    }
  }
}

module.exports = { PDFKitService };