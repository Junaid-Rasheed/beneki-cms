"use strict";

const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

class PDFKitService {
  static async generateInvoicePDF(order) {
    return new Promise((resolve, reject) => {
      try {
        console.log('📄 Generating PDF with exact UI design for order:', order.invoiceNumber);
        
        const doc = new PDFDocument({ 
          margin: 30,
          size: 'A4'
        });
        const chunks = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add content to PDF with exact styling
        this.buildExactInvoicePDF(doc, order);
        
        // Finalize PDF
        doc.end();
        
      } catch (error) {
        console.error('❌ PDF generation error:', error);
        reject(error);
      }
    });
  }

  static buildExactInvoicePDF(doc, order) {
    const products = order.products || [];
    const paymentData = order.paymentData || [];
    const vatBreakdown = order.vatBreakdown || [];

    // ===== HEADER SECTION =====
    // Left Section - Company Info
    doc.fontSize(11)
       .text('691 rue Maurice Caullery', 50, 50)
       .text('59500 Douai', 50, 62)
       .text('FRANCE', 50, 74)
       .text('www.beneki.net', 50, 86)
       .text('Tel. 03 74 09 81 86', 50, 98);

    // Right Section - Invoice Info
    doc.fontSize(14).font('Helvetica-Bold')
       .text('INVOICE', 350, 50);
    
    doc.fontSize(9).font('Helvetica')
       .text(`N° ${order.invoiceNumber}`, 350, 75)
       .text(`Date : ${order.invoiceDate}`, 350, 87);
    
    doc.font('Helvetica-Bold')
       .text('Customer Company Name', 350, 105);
    doc.font('Helvetica')
       .text(order.customerCompany || 'N/A', 350, 117)
       .text(order.customerAddress || 'N/A', 350, 129)
       .text(order.customerCity || 'N/A', 350, 141)
       .text(order.customerCountry || 'N/A', 350, 153);
    
    doc.text(`Client ref : ${order.clientRef || 'N/A'}`, 350, 171)
       .text(`Email : ${order.clientEmail || 'N/A'}`, 350, 183)
       .text(`TVA Intracom : ${order.customerVAT || 'N/A'}`, 350, 195);

    // ===== DELIVERY ADDRESS SECTION =====
    const deliveryY = 220;
    doc.rect(50, deliveryY, 495, 60).stroke();
    doc.fontSize(10).font('Helvetica-Bold')
       .fillColor('white')
       .rect(50, deliveryY, 495, 15).fillAndStroke('#4e5f4b', '#4e5f4b')
       .fillColor('black')
       .text('Delivery address :', 53, deliveryY + 3);
    
    doc.fontSize(9).font('Helvetica')
       .text(order.deliveryName || 'N/A', 52, deliveryY + 20)
       .text(order.deliveryAddress || 'N/A', 52, deliveryY + 32)
       .text(order.deliveryPhone || 'N/A', 52, deliveryY + 44);
    
    if (order.deliveryNote) {
      doc.text(`Note: ${order.deliveryNote}`, 52, deliveryY + 56);
    }

    // ===== PRODUCTS TABLE =====
    const tableY = deliveryY + 70;
    
    // Table Header
    doc.rect(50, tableY, 495, 15).fillAndStroke('#4e5f4b', '#4e5f4b');
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
       .text('Reference', 52, tableY + 4)
       .text('Product', 50 + (495 * 0.12) + 2, tableY + 4)
       .text('Qty', 50 + (495 * 0.44) + 2, tableY + 4)
       .text('Price VAT Excluded', 50 + (495 * 0.54) + 2, tableY + 4)
       .text('Total VAT Excluded', 50 + (495 * 0.72) + 2, tableY + 4)
       .text('VAT %', 50 + (495 * 0.90) + 2, tableY + 4);

    doc.fillColor('black');
    let currentY = tableY + 15;
    
    // Table Rows
    products.forEach((product, index) => {
      if (currentY > 650) {
        doc.addPage();
        currentY = 50;
      }
      
      doc.rect(50, currentY, 495, 20).stroke();
      doc.fontSize(8).font('Helvetica')
         .text(product.reference || 'N/A', 52, currentY + 6)
         .text(product.name || 'N/A', 50 + (495 * 0.12) + 2, currentY + 6)
         .text(product.qty?.toString() || '0', 50 + (495 * 0.44) + 2, currentY + 6)
         .text(product.unitPrice || '0.00 €', 50 + (495 * 0.54) + 2, currentY + 6)
         .text(product.totalExclVat || '0.00 €', 50 + (495 * 0.72) + 2, currentY + 6)
         .text(`${product.vatRate || 0}%`, 50 + (495 * 0.90) + 2, currentY + 6);
      
      currentY += 20;
    });

    // If no products, show empty row
    if (products.length === 0) {
      doc.rect(50, currentY, 495, 20).stroke();
      doc.text('No products', 52, currentY + 6);
      currentY += 20;
    }

    // ===== TOTALS SECTION =====
    const totalsY = currentY + 20;
    
    // Payment Type Section (Left)
    const paymentSectionWidth = 240;
    doc.rect(50, totalsY, paymentSectionWidth, 120).stroke();
    
    // Payment Title
    doc.rect(50, totalsY, paymentSectionWidth, 15).fillAndStroke('#4e5f4b', '#4e5f4b');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
       .text('Payment Type', 50, totalsY + 3, { width: paymentSectionWidth, align: 'center' });
    
    doc.fillColor('black');
    let paymentY = totalsY + 15;
    
    // Payment Methods
    paymentData.forEach((payment, index) => {
      doc.rect(50, paymentY, paymentSectionWidth, 20).stroke();
      doc.fontSize(9).font('Helvetica-Bold')
         .text(payment.paymentType || 'N/A', 56, paymentY + 6)
         .text(payment.amount || '0.00 €', 50 + paymentSectionWidth - 56, paymentY + 6, { align: 'right' });
      paymentY += 20;
    });

    // VAT Breakdown
    const vatStartY = paymentY;
    vatBreakdown.forEach((vat, index) => {
      doc.fontSize(8).font('Helvetica')
         .text('VAT', 56, vatStartY + (index * 20) + 6)
         .text(vat.rate || '0%', 50 + paymentSectionWidth - 56, vatStartY + (index * 20) + 6, { align: 'right' })
         .text('Base', 56, vatStartY + (index * 20) + 18)
         .text(vat.base || '0.00 €', 50 + paymentSectionWidth - 56, vatStartY + (index * 20) + 18, { align: 'right' })
         .text('Total', 56, vatStartY + (index * 20) + 30)
         .text(vat.total || '0.00 €', 50 + paymentSectionWidth - 56, vatStartY + (index * 20) + 30, { align: 'right' });
    });

    // Summary Table (Right)
    const summaryX = 50 + paymentSectionWidth + 15;
    const summaryWidth = 240;
    doc.rect(summaryX, totalsY, summaryWidth, 120).stroke();
    
    // Summary Rows
    doc.rect(summaryX, totalsY, summaryWidth, 30).fillAndStroke('#f0f0f0', '#000');
    doc.fontSize(9).font('Helvetica-Bold')
       .text('TOTAL', summaryX + 6, totalsY + 10)
       .text(order.grandTotal || '0.00 €', summaryX + summaryWidth - 6, totalsY + 10, { align: 'right' });
    
    doc.rect(summaryX, totalsY + 30, summaryWidth, 30).stroke();
    doc.font('Helvetica')
       .text('Total VAT EXCL', summaryX + 6, totalsY + 40)
       .text(order.totalExclVat || '0.00 €', summaryX + summaryWidth - 6, totalsY + 40, { align: 'right' });
    
    doc.rect(summaryX, totalsY + 60, summaryWidth, 30).stroke();
    doc.text('VAT', summaryX + 6, totalsY + 70)
       .text(order.totalVat || '0.00 €', summaryX + summaryWidth - 6, totalsY + 70, { align: 'right' });
    
    doc.rect(summaryX, totalsY + 90, summaryWidth, 30).stroke();
    doc.font('Helvetica-Bold')
       .text('Total VAT INCL', summaryX + 6, totalsY + 100)
       .text(order.grandTotal || '0.00 €', summaryX + summaryWidth - 6, totalsY + 100, { align: 'right' });

    // ===== BANK DETAILS =====
    const bankY = totalsY + 140;
    doc.rect(50, bankY, 495, 40).stroke();
    doc.fontSize(8).font('Helvetica-Bold')
       .text('Bank Details', 52, bankY + 5);
    
    doc.font('Helvetica-Bold')
       .text('BNP PARIBAS', 52, bankY + 15);
    doc.font('Helvetica')
       .text(`IBAN: ${order.bankDetails?.iban || 'FR76 3000 4000 0100 1234 5678 900'}`, 52, bankY + 25)
       .text(`BIC: ${order.bankDetails?.bic || 'BNPAFRPP'}`, 52, bankY + 35);

    // ===== FOOTER TEXT =====
    const footerY = bankY + 50;
    doc.fontSize(7)
       .text('BENEKI conserve la propriété pleine et entière des marchandises jusqu\'au complet paiement du prix suivant la loi 80.335 du 12 mai 1980. Pas d\'escompte pour paiement anticipé. En cas de paiement hors délai, une pénalité égale à trois fois le taux de l\'intérêt légal sera appliquée, ainsi qu\'une indemnité forfaitaire de 40 €uros pour frais de recouvrement L-411-6 du Code de Commerce. Les conditions générales de ventes applicables sont disponibles sur notre site www.beneki.net', 
             50, footerY, { width: 495, align: 'justify' });

    // ===== LEGAL FOOTER =====
    const legalY = footerY + 40;
    doc.moveTo(50, legalY).lineTo(545, legalY).stroke();
    doc.fontSize(7)
       .text('BENEKI SARL / Capital 150 000€ / VAT Number : FR61889408019 / Siret 88940801900020 / APE 4690Z', 
             50, legalY + 5, { width: 495, align: 'center' });

    // ===== PAGE INFO =====
    doc.fontSize(8).fillColor('#666')
       .text('Page 1/1', 545, 30, { align: 'right' });
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