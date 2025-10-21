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
    doc.rect(50, deliveryY, 495, 40).stroke();
    
    // Green header
    doc.rect(50, deliveryY, 495, 15).fillAndStroke('#4e5f4b', '#4e5f4b');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
       .text('Delivery address :', 53, deliveryY + 3);
    
    // Delivery content
    doc.fillColor('black').fontSize(9).font('Helvetica')
       .text(order.deliveryName || 'N/A', 52, deliveryY + 20)
       .text(order.deliveryAddress || 'N/A', 52, deliveryY + 32);
    
    if (order.deliveryPhone && order.deliveryPhone !== 'N/A') {
      doc.text(order.deliveryPhone, 52, deliveryY + 44);
    }

    // ===== PRODUCTS TABLE =====
    const tableY = deliveryY + 50;
    const colWidths = {
      reference: 495 * 0.12,    // 12%
      product: 495 * 0.32,      // 32% 
      qty: 495 * 0.10,          // 10%
      price: 495 * 0.18,        // 18%
      total: 495 * 0.18,        // 18%
      vat: 495 * 0.10           // 10%
    };

    // Table Header
    doc.rect(50, tableY, 495, 15).fillAndStroke('#4e5f4b', '#4e5f4b');
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
       .text('Reference', 52, tableY + 4)
       .text('Product', 50 + colWidths.reference + 2, tableY + 4)
       .text('Qty', 50 + colWidths.reference + colWidths.product + 2, tableY + 4)
       .text('Price VAT Excluded', 50 + colWidths.reference + colWidths.product + colWidths.qty + 2, tableY + 4)
       .text('Total VAT Excluded', 50 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 2, tableY + 4)
       .text('VAT %', 50 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 2, tableY + 4);

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
         .text(product.name || 'N/A', 50 + colWidths.reference + 2, currentY + 6)
         .text(product.qty?.toString() || '0', 50 + colWidths.reference + colWidths.product + 2, currentY + 6)
         .text(product.unitPrice || '0.00 €', 50 + colWidths.reference + colWidths.product + colWidths.qty + 2, currentY + 6)
         .text(product.totalExclVat || '0.00 €', 50 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 2, currentY + 6)
         .text(`${product.vatRate || 0}%`, 50 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 2, currentY + 6);
      
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
    const sectionWidth = 240;
    const gap = 15;

    // Payment Type Section (Left)
    doc.rect(50, totalsY, sectionWidth, 100).stroke();
    
    // Payment Title
    doc.rect(50, totalsY, sectionWidth, 15).fillAndStroke('#4e5f4b', '#4e5f4b');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
       .text('Payment Type', 50, totalsY + 3, { width: sectionWidth, align: 'center' });
    
    doc.fillColor('black');
    
    // Payment Methods
    let paymentY = totalsY + 15;
    paymentData.forEach((payment, index) => {
      doc.rect(50, paymentY, sectionWidth, 25).stroke();
      doc.fontSize(9).font('Helvetica-Bold')
         .text(payment.paymentType || 'N/A', 56, paymentY + 8)
         .text(payment.amount || '0.00 €', 50 + sectionWidth - 56, paymentY + 8, { align: 'right' });
      paymentY += 25;
    });

    // VAT Breakdown
    if (vatBreakdown.length > 0) {
      const vatY = paymentY;
      vatBreakdown.forEach((vat, index) => {
        doc.fontSize(8).font('Helvetica')
           .text('VAT', 56, vatY + 5)
           .text(vat.rate || '0%', 50 + sectionWidth - 56, vatY + 5, { align: 'right' })
           .text('Base', 56, vatY + 15)
           .text(vat.base || '0.00 €', 50 + sectionWidth - 56, vatY + 15, { align: 'right' })
           .text('Total', 56, vatY + 25)
           .text(vat.total || '0.00 €', 50 + sectionWidth - 56, vatY + 25, { align: 'right' });
      });
    }

    // Summary Table (Right)
    const summaryX = 50 + sectionWidth + gap;
    doc.rect(summaryX, totalsY, sectionWidth, 100).stroke();
    
    // Summary Rows
    const rowHeight = 25;
    
    // TOTAL row (gray background)
    doc.rect(summaryX, totalsY, sectionWidth, rowHeight).fillAndStroke('#f0f0f0', '#000');
    doc.fontSize(9).font('Helvetica-Bold')
       .text('TOTAL', summaryX + 6, totalsY + 8)
       .text(order.grandTotal || '0.00 €', summaryX + sectionWidth - 6, totalsY + 8, { align: 'right' });
    
    // Total VAT EXCL
    doc.rect(summaryX, totalsY + rowHeight, sectionWidth, rowHeight).stroke();
    doc.font('Helvetica')
       .text('Total VAT EXCL', summaryX + 6, totalsY + rowHeight + 8)
       .text(order.totalExclVat || '0.00 €', summaryX + sectionWidth - 6, totalsY + rowHeight + 8, { align: 'right' });
    
    // VAT
    doc.rect(summaryX, totalsY + (rowHeight * 2), sectionWidth, rowHeight).stroke();
    doc.text('VAT', summaryX + 6, totalsY + (rowHeight * 2) + 8)
       .text(order.totalVat || '0.00 €', summaryX + sectionWidth - 6, totalsY + (rowHeight * 2) + 8, { align: 'right' });
    
    // Total VAT INCL
    doc.rect(summaryX, totalsY + (rowHeight * 3), sectionWidth, rowHeight).stroke();
    doc.font('Helvetica-Bold')
       .text('Total VAT INCL', summaryX + 6, totalsY + (rowHeight * 3) + 8)
       .text(order.grandTotal || '0.00 €', summaryX + sectionWidth - 6, totalsY + (rowHeight * 3) + 8, { align: 'right' });

    // ===== BANK DETAILS =====
    const bankY = totalsY + 120;
    doc.rect(50, bankY, 495, 30).stroke();
    doc.fontSize(8).font('Helvetica-Bold')
       .text('Bank Details', 52, bankY + 5);
    
    doc.font('Helvetica-Bold')
       .text('BNP PARIBAS', 52, bankY + 15);
    doc.font('Helvetica')
       .text(`IBAN: ${order.bankDetails?.iban || 'FR76 3000 4000 0100 1234 5678 900'}`, 52, bankY + 25)
       .text(`BIC: ${order.bankDetails?.bic || 'BNPAFRPP'}`, 200, bankY + 25);

    // ===== FOOTER TEXT =====
    const footerY = bankY + 40;
    doc.fontSize(7)
       .text('BENEKI conserve la propriété pleine et entière des marchandises jusqu\'au complet paiement du prix suivant la loi 80.335 du 12 mai 1980. Pas d\'escompte pour paiement anticipé. En cas de paiement hors délai, une pénalité égale à trois fois le taux de l\'intérêt légal sera appliquée, ainsi qu\'une indemnité forfaitaire de 40 €uros pour frais de recouvrement L-411-6 du Code de Commerce. Les conditions générales de ventes applicables sont disponibles sur notre site www.beneki.net', 
             50, footerY, { width: 495, align: 'justify', lineGap: 1 });

    // ===== LEGAL FOOTER =====
    const legalY = footerY + 35;
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