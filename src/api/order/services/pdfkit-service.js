// "use strict";

// const PDFDocument = require("pdfkit");
// const fs = require("fs").promises;
// const path = require("path");

// class PDFKitService {
//   static async generateInvoicePDF(order) {
//     return new Promise((resolve, reject) => {
//       try {
//         console.log("📄 Generating modern styled PDF for order:", order.invoiceNumber);

//         const doc = new PDFDocument({
//           margin: 30,
//           size: "A4",
//         });
//         const chunks = [];

//         doc.on("data", (chunk) => chunks.push(chunk));
//         doc.on("end", () => resolve(Buffer.concat(chunks)));
//         doc.on("error", reject);

//         // Build styled PDF
//         this.buildExactInvoicePDF(doc, order);

//         doc.end();
//       } catch (error) {
//         console.error("❌ PDF generation error:", error);
//         reject(error);
//       }
//     });
//   }

//   static buildExactInvoicePDF(doc, order) {
//     const products = order.products || [];
//     const paymentData = order.paymentData || [];
//     const vatBreakdown = order.vatBreakdown || [];

//     const primaryColor = "#4e5f4b";
//     const grayBg = "#f0f0f0";

//     // ===== HEADER =====
//     // Optional Logo (uncomment if logo path exists)
//     // doc.image(path.join(__dirname, 'logo9.png'), 50, 40, { width: 120 });

//     // Left: Company Info
//     doc.fontSize(11)
//       .font("Helvetica")
//       .text("691 rue Maurice Caullery", 50, 110)
//       .text("59500 Douai", 50, 124)
//       .text("FRANCE", 50, 138)
//       .text("www.beneki.net", 50, 152)
//       .text("Tel. 03 74 09 81 86", 50, 166);

//     // Right: Invoice Info
//     doc.font("Helvetica-Bold")
//       .fontSize(16)
//       .text("INVOICE", 400, 50, { align: "right" });

//     doc.font("Helvetica")
//       .fontSize(9)
//       .text(`N° ${order.invoiceNumber}`, 350, 75)
//       .text(`Date : ${order.invoiceDate}`, 350, 87);

//     doc.font("Helvetica-Bold").text("Customer Company Name", 350, 105);
//     doc.font("Helvetica")
//       .text(order.customerCompany || "N/A", 350, 117)
//       .text(order.customerAddress || "N/A", 350, 129)
//       .text(order.customerCity || "N/A", 350, 141)
//       .text(order.customerCountry || "N/A", 350, 153);

//     doc.text(`Client ref : ${order.clientRef || "N/A"}`, 350, 171)
//       .text(`Email : ${order.clientEmail || "N/A"}`, 350, 183)
//       .text(`TVA Intracom : ${order.customerVAT || "N/A"}`, 350, 195);

//     // ===== DELIVERY ADDRESS =====
//     const deliveryY = 220;
//     doc.rect(50, deliveryY, 495, 60).stroke();

//     // Header
//     doc.rect(50, deliveryY, 495, 18).fillAndStroke(primaryColor, primaryColor);
//     doc.fillColor("white")
//       .fontSize(10)
//       .font("Helvetica-Bold")
//       .text("Delivery address :", 58, deliveryY + 4);

//     // Address
//     doc.fillColor("black").fontSize(9).font("Helvetica");
//     doc.text(order.deliveryName || "N/A", 58, deliveryY + 25);
//     doc.text(order.deliveryAddress || "N/A", 58, deliveryY + 37);
//     if (order.deliveryPhone && order.deliveryPhone !== "N/A") {
//       doc.text(order.deliveryPhone, 58, deliveryY + 49);
//     }

//     // ===== PRODUCTS TABLE =====
//     const tableY = deliveryY + 70;
//     const colWidths = {
//       reference: 495 * 0.12,
//       product: 495 * 0.32,
//       qty: 495 * 0.10,
//       price: 495 * 0.18,
//       total: 495 * 0.18,
//       vat: 495 * 0.10,
//     };

//     // Header row
//     doc.rect(50, tableY, 495, 18).fillAndStroke(primaryColor, primaryColor);
//     doc.fillColor("white").fontSize(8).font("Helvetica-Bold");
//     doc.text("Reference", 52, tableY + 4);
//     doc.text("Product", 50 + colWidths.reference + 4, tableY + 4);
//     doc.text("Qty", 50 + colWidths.reference + colWidths.product + 4, tableY + 4);
//     doc.text(
//       "Price VAT Excluded",
//       50 + colWidths.reference + colWidths.product + colWidths.qty + 4,
//       tableY + 4
//     );
//     doc.text(
//       "Total VAT Excluded",
//       50 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4,
//       tableY + 4
//     );
//     doc.text(
//       "VAT %",
//       50 +
//         colWidths.reference +
//         colWidths.product +
//         colWidths.qty +
//         colWidths.price +
//         colWidths.total +
//         4,
//       tableY + 4
//     );

//     doc.fillColor("black").fontSize(8);
//     let currentY = tableY + 18;

//     // Table rows
//     products.forEach((product, i) => {
//       if (currentY > 650) {
//         doc.addPage();
//         currentY = 50;
//       }

//       doc.rect(50, currentY, 495, 18).stroke();
//       doc.text(product.reference || "N/A", 52, currentY + 5);
//       doc.text(product.name || "N/A", 50 + colWidths.reference + 4, currentY + 5);
//       doc.text(product.qty?.toString() || "0", 50 + colWidths.reference + colWidths.product + 4, currentY + 5);
//       doc.text(product.unitPrice || "0.00 €", 50 + colWidths.reference + colWidths.product + colWidths.qty + 4, currentY + 5);
//       doc.text(product.totalExclVat || "0.00 €", 50 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4, currentY + 5);
//       doc.text(`${product.vatRate || 0}%`, 50 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 4, currentY + 5);

//       currentY += 18;
//     });

//     if (products.length === 0) {
//       doc.rect(50, currentY, 495, 18).stroke();
//       doc.text("No products", 52, currentY + 5);
//       currentY += 18;
//     }

//     // ===== TOTALS SECTION =====
//     const totalsY = currentY + 25;
//     const sectionWidth = 240;
//     const gap = 15;

//     // Left: Payment Type
//     doc.rect(50, totalsY, sectionWidth, 110).stroke();
//     doc.rect(50, totalsY, sectionWidth, 18).fillAndStroke(primaryColor, primaryColor);
//     doc.fillColor("white").fontSize(10).font("Helvetica-Bold").text("Payment Type", 50, totalsY + 4, {
//       width: sectionWidth,
//       align: "center",
//     });

//     doc.fillColor("black");
//     let paymentY = totalsY + 18;

//     paymentData.forEach((payment) => {
//       doc.rect(50, paymentY, sectionWidth, 25).stroke();
//       doc.fontSize(9).font("Helvetica-Bold");
//       doc.text(payment.paymentType || "N/A", 56, paymentY + 8);
//       doc.text(payment.amount || "0.00 €", 50 + sectionWidth - 56, paymentY + 8, { align: "right" });
//       paymentY += 25;
//     });

//     if (vatBreakdown.length > 0) {
//       const vatY = paymentY;
//       vatBreakdown.forEach((vat) => {
//         doc.fontSize(8).font("Helvetica");
//         doc.text("VAT", 56, vatY + 5);
//         doc.text(vat.rate || "0%", 50 + sectionWidth - 56, vatY + 5, { align: "right" });
//         doc.text("Base", 56, vatY + 15);
//         doc.text(vat.base || "0.00 €", 50 + sectionWidth - 56, vatY + 15, { align: "right" });
//         doc.text("Total", 56, vatY + 25);
//         doc.text(vat.total || "0.00 €", 50 + sectionWidth - 56, vatY + 25, { align: "right" });
//       });
//     }

//     // Right: Summary
//     const summaryX = 50 + sectionWidth + gap;
//     doc.rect(summaryX, totalsY, sectionWidth, 110).stroke();

//     const rowH = 25;

//     // TOTAL (gray)
//     doc.rect(summaryX, totalsY, sectionWidth, rowH).fillAndStroke(grayBg, "#000");
//     doc.fillColor("black").fontSize(9).font("Helvetica-Bold");
//     doc.text("TOTAL", summaryX + 6, totalsY + 8);
//     doc.text(order.grandTotal || "0.00 €", summaryX + sectionWidth - 6, totalsY + 8, { align: "right" });

//     // VAT Excl
//     doc.fillColor("black").font("Helvetica");
//     doc.rect(summaryX, totalsY + rowH, sectionWidth, rowH).stroke();
//     doc.text("Total VAT EXCL", summaryX + 6, totalsY + rowH + 8);
//     doc.text(order.totalExclVat || "0.00 €", summaryX + sectionWidth - 6, totalsY + rowH + 8, { align: "right" });

//     // VAT
//     doc.rect(summaryX, totalsY + rowH * 2, sectionWidth, rowH).stroke();
//     doc.text("VAT", summaryX + 6, totalsY + rowH * 2 + 8);
//     doc.text(order.totalVat || "0.00 €", summaryX + sectionWidth - 6, totalsY + rowH * 2 + 8, { align: "right" });

//     // VAT Incl (bold)
//     doc.rect(summaryX, totalsY + rowH * 3, sectionWidth, rowH).stroke();
//     doc.font("Helvetica-Bold");
//     doc.text("Total VAT INCL", summaryX + 6, totalsY + rowH * 3 + 8);
//     doc.text(order.grandTotal || "0.00 €", summaryX + sectionWidth - 6, totalsY + rowH * 3 + 8, { align: "right" });

//     // ===== BANK DETAILS =====
//     const bankY = totalsY + 130;
//     doc.rect(50, bankY, 495, 35).stroke();
//     doc.fontSize(8).font("Helvetica-Bold").text("Bank Details", 56, bankY + 6);
//     doc.font("Helvetica-Bold").text("BNP PARIBAS", 56, bankY + 18);
//     doc.font("Helvetica")
//       .text(`IBAN: ${order.bankDetails?.iban || "FR76 3000 4000 0100 1234 5678 900"}`, 180, bankY + 18)
//       .text(`BIC: ${order.bankDetails?.bic || "BNPAFRPP"}`, 400, bankY + 18);

//     // ===== FOOTER =====
//     const footerY = bankY + 50;
//     doc.fontSize(7).fillColor("black").font("Helvetica");
//     doc.text(
//       "BENEKI conserve la propriété pleine et entière des marchandises jusqu'au complet paiement du prix suivant la loi 80.335 du 12 mai 1980. Pas d'escompte pour paiement anticipé. En cas de paiement hors délai, une pénalité égale à trois fois le taux de l'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de 40 €uros pour frais de recouvrement L-411-6 du Code de Commerce. Les conditions générales de ventes applicables sont disponibles sur notre site www.beneki.net",
//       50,
//       footerY,
//       { width: 495, align: "justify", lineGap: 1 }
//     );

//     const legalY = footerY + 35;
//     doc.moveTo(50, legalY).lineTo(545, legalY).stroke();
//     doc.fontSize(7).text(
//       "BENEKI SARL / Capital 150 000€ / VAT Number : FR61889408019 / Siret 88940801900020 / APE 4690Z",
//       50,
//       legalY + 5,
//       { width: 495, align: "center" }
//     );

//     // Page info
//     doc.fontSize(8).fillColor("#666").text("Page 1/1", 545, 30, { align: "right" });
//   }

//   static async generateAndSaveInvoice(orderData, filePath) {
//     try {
//       console.log("💾 Saving PDF to:", filePath);

//       const dir = path.dirname(filePath);
//       await fs.mkdir(dir, { recursive: true });

//       const pdfBuffer = await this.generateInvoicePDF(orderData);
//       await fs.writeFile(filePath, pdfBuffer);

//       console.log("✅ PDF saved successfully, size:", pdfBuffer.length, "bytes");
//       return filePath;
//     } catch (error) {
//       console.error("❌ Error saving PDF:", error);
//       throw error;
//     }
//   }
// }

// module.exports = { PDFKitService };
"use strict";

const PDFDocument = require("pdfkit");
const fs = require("fs").promises;
const path = require("path");

class PDFKitService {
  static async generateInvoicePDF(order) {
    return new Promise((resolve, reject) => {
      try {
        console.log("📄 Generating exact UI PDF for order:", order.invoiceNumber);

        const doc = new PDFDocument({
          margin: 30,
          size: "A4",
        });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Build exact same UI as React PDF
        this.buildExactSameUI(doc, order);

        doc.end();
      } catch (error) {
        console.error("❌ PDF generation error:", error);
        reject(error);
      }
    });
  }

  static buildExactSameUI(doc, order) {
    const products = order.products || [];
    const paymentData = order.paymentData || [];
    const vatBreakdown = order.vatBreakdown || [];
    
    const primaryColor = "#4e5f4b"; // Green background for headers
    const borderRadius = 8;

    // Helper function to format currency like React version
    const formatCurrency = (value) => {
      if (!value) return "€ 0.00";
      if (typeof value === 'string' && value.includes('€')) {
        return value.replace('€', '€ ').replace('  ', ' ');
      }
      const numericValue = typeof value === 'string' ? value.replace('€', '').trim() : value;
      return `€ ${numericValue}`;
    };

    // ===== PAGE NUMBER =====
    doc.fontSize(8)
       .fillColor("#666")
       .text("Page 1/1", 495, 30, { align: "right" });

    // ===== HEADER SECTION =====
    // Left Section - Company Info with Logo
    // Note: Uncomment and adjust path if you have the logo file
       doc.image(path.join(__dirname, '/logo9.png'), 30, 30, { width: 180, height: 60 });
    
    // Company address (positioned where logo would end)
    doc.fontSize(11)
       .fillColor("black")
       .font("Helvetica")
       .text("691 rue Maurice Coulery", 30, 100)
       .text("59500 Douai", 30, 114)
       .text("FRANCE", 30, 128)
       .text("www.beneki.net", 30, 142)
       .text("Tel. 03 74 09 81 86", 30, 156);

    // Right Section - Invoice Info (exact positioning like React)
    doc.font("Helvetica-Bold")
       .fontSize(14)
       .text("INVOICE", 350, 30);

    doc.font("Helvetica")
       .fontSize(9)
       .text(`N° ${order.invoiceNumber || "ORD-0000014"}`, 350, 55)
       .text(`Date : ${order.invoiceDate || "10/28/2025"}`, 350, 67);

    // Customer Info Section
    doc.font("Helvetica-Bold")
       .text("Customer Company Name", 350, 85);
    
    doc.font("Helvetica")
       .text(order.customerCompany || "daily info", 350, 97)
       .text(order.customerAddress || "Address not provided", 350, 109)
       .text(order.customerCity || "N/A", 350, 121)
       .text(order.customerCountry || "France", 350, 133);

    // Client reference info
    doc.text(`Client ref : ${order.clientRef || "ldsj6cawoldsf0/pagono991"}`, 350, 151)
       .text(`Email : ${order.clientEmail || "dailyinfoiniverse@gmail.com"}`, 350, 163)
       .text(`TVA Intracom : ${order.customerVAT || "N/A"}`, 350, 175);

    // ===== DELIVERY ADDRESS SECTION =====
    const deliveryY = 200;
    this.drawRoundedRect(doc, 30, deliveryY, 525, 40, borderRadius);
    
    // Section Title with background
    doc.save();
    doc.rect(30, deliveryY, 525, 15).fill(primaryColor);
    doc.restore();
    doc.rect(30, deliveryY, 525, 15).stroke();
    
    doc.fillColor("black")
       .fontSize(10)
       .font("Helvetica-Bold")
       .text("Delivery address :", 35, deliveryY + 3);

    // Address Content
    doc.fillColor("black")
       .fontSize(9)
       .font("Helvetica")
       .text(order.deliveryName || order.customerCompany || "daily info", 35, deliveryY + 20)
       .text(order.deliveryAddress || "Address not provided", 35, deliveryY + 32)
       .text(order.deliveryPhone || "N/A", 35, deliveryY + 44);

    // ===== PRODUCTS TABLE SECTION =====
    const tableY = deliveryY + 60;
    this.drawRoundedRect(doc, 30, tableY, 525, 200, borderRadius);
    
    // Table column widths (exact same as React version)
    const colWidths = {
      reference: 63,    // 12% of 525
      product: 168,     // 32% of 525
      qty: 52.5,        // 10% of 525
      price: 94.5,      // 18% of 525
      total: 94.5,      // 18% of 525
      vat: 52.5,        // 10% of 525
    };

    // Table Header with background
    doc.save();
    doc.rect(30, tableY, 525, 20).fill(primaryColor);
    doc.restore();
    this.drawRoundedRect(doc, 30, tableY, 525, 20, borderRadius);
    
    // Header texts
    doc.fillColor("black")
       .fontSize(8)
       .font("Helvetica-Bold")
       .text("Reference", 34, tableY + 6)
       .text("Product", 30 + colWidths.reference + 4, tableY + 6)
       .text("Qty", 30 + colWidths.reference + colWidths.product + 4, tableY + 6)
       .text("Price VAT Excluded", 30 + colWidths.reference + colWidths.product + colWidths.qty + 4, tableY + 6)
       .text("Total VAT Excluded", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4, tableY + 6)
       .text("VAT %", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 4, tableY + 6);

    // Table Rows
    let currentY = tableY + 20;
    const rowHeight = 18;
    
    if (products.length > 0) {
      products.forEach((product, index) => {
        if (currentY > tableY + 180) return;
        
        // Draw row border
        doc.rect(30, currentY, 525, rowHeight).stroke();
        
        doc.fontSize(8)
           .font("Helvetica")
           .text(product.reference || "HOSTING-001", 34, currentY + 5)
           .text(product.name || "Web Hosting Service", 30 + colWidths.reference + 4, currentY + 5)
           .text((product.qty || 1).toString(), 30 + colWidths.reference + colWidths.product + 4, currentY + 5)
           .text(formatCurrency(product.unitPrice || "100.00"), 30 + colWidths.reference + colWidths.product + colWidths.qty + 4, currentY + 5)
           .text(formatCurrency(product.totalExclVat || "100.00"), 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4, currentY + 5)
           .text(`${product.vatRate || 20}%`, 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 4, currentY + 5);
        
        currentY += rowHeight;
      });
      
      // Fill remaining space with empty rows if needed
      const remainingRows = Math.floor((tableY + 200 - currentY) / rowHeight);
      for (let i = 0; i < remainingRows && i < 10; i++) {
        doc.rect(30, currentY, 525, rowHeight).stroke();
        doc.text("-", 34, currentY + 5)
           .text("-", 30 + colWidths.reference + 4, currentY + 5)
           .text("-", 30 + colWidths.reference + colWidths.product + 4, currentY + 5)
           .text("-", 30 + colWidths.reference + colWidths.product + colWidths.qty + 4, currentY + 5)
           .text("-", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4, currentY + 5)
           .text("-", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 4, currentY + 5);
        currentY += rowHeight;
      }
    } else {
      // Fill with empty rows like React version
      for (let i = 0; i < 10; i++) {
        if (currentY > tableY + 180) break;
        
        doc.rect(30, currentY, 525, rowHeight).stroke();
        doc.text("-", 34, currentY + 5)
           .text("-", 30 + colWidths.reference + 4, currentY + 5)
           .text("-", 30 + colWidths.reference + colWidths.product + 4, currentY + 5)
           .text("-", 30 + colWidths.reference + colWidths.product + colWidths.qty + 4, currentY + 5)
           .text("-", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4, currentY + 5)
           .text("-", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 4, currentY + 5);
        
        currentY += rowHeight;
      }
    }

    // ===== FOOTER SECTION =====
    const footerY = tableY + 210;

    // Top Row: Payment Type, VAT, Total
    const topRowY = footerY;
    const boxWidth = (525 - 16) / 3; // 3 boxes with 8px gap
    
    // Payment Type Box
    this.drawRoundedRect(doc, 30, topRowY, boxWidth, 80, borderRadius);
    doc.save();
    doc.rect(30, topRowY, boxWidth, 18).fill(primaryColor);
    doc.restore();
    this.drawRoundedRect(doc, 30, topRowY, boxWidth, 18, borderRadius);
    
    doc.fillColor("black")
       .fontSize(10)
       .font("Helvetica-Bold")
       .text("Payment Type", 34, topRowY + 4);
    
    doc.fontSize(9).font("Helvetica");
    let paymentY = topRowY + 25;
    if (paymentData.length > 0) {
      paymentData.forEach((payment, index) => {
        doc.text(payment.paymentType || "PAYPAL", 34, paymentY);
        paymentY += 12;
      });
    } else {
      doc.text("PAYPAL", 34, paymentY);
    }

    // VAT Breakdown Box
    const vatBoxX = 30 + boxWidth + 8;
    this.drawRoundedRect(doc, vatBoxX, topRowY, boxWidth, 80, borderRadius);
    doc.save();
    doc.rect(vatBoxX, topRowY, boxWidth, 18).fill(primaryColor);
    doc.restore();
    this.drawRoundedRect(doc, vatBoxX, topRowY, boxWidth, 18, borderRadius);
    
    // VAT Header Row
    const vatColWidth = boxWidth / 3;
    doc.fillColor("black")
       .fontSize(9)
       .font("Helvetica-Bold")
       .text("VAT", vatBoxX + 4, topRowY + 4)
       .text("Base", vatBoxX + vatColWidth, topRowY + 4, { align: "center" })
       .text("Total", vatBoxX + vatColWidth * 2, topRowY + 4, { align: "center" });

    // VAT Content
    let vatContentY = topRowY + 25;
    if (vatBreakdown.length > 0) {
      vatBreakdown.forEach((vat, index) => {
        doc.fontSize(8).font("Helvetica")
           .text(vat.rate || "20%", vatBoxX + 4, vatContentY)
           .text(formatCurrency(vat.base || "100.00"), vatBoxX + vatColWidth, vatContentY, { align: "center" })
           .text(formatCurrency(vat.total || "20.00"), vatBoxX + vatColWidth * 2, vatContentY, { align: "center" });
        vatContentY += 10;
      });
    } else {
      // Default VAT data matching the image
      doc.fontSize(8).font("Helvetica")
         .text("20%", vatBoxX + 4, vatContentY)
         .text(formatCurrency("100.00"), vatBoxX + vatColWidth, vatContentY, { align: "center" })
         .text(formatCurrency("20.00"), vatBoxX + vatColWidth * 2, vatContentY, { align: "center" });
    }

    // Total Box
    const totalBoxX = vatBoxX + boxWidth + 8;
    this.drawRoundedRect(doc, totalBoxX, topRowY, boxWidth, 80, borderRadius);
    doc.save();
    doc.rect(totalBoxX, topRowY, boxWidth, 18).fill(primaryColor);
    doc.restore();
    this.drawRoundedRect(doc, totalBoxX, topRowY, boxWidth, 18, borderRadius);
    
    // Total Header
    doc.fillColor("black")
       .fontSize(10)
       .font("Helvetica-Bold")
       .text("TOTAL", totalBoxX + 8, topRowY + 4)
       .text(formatCurrency(order.grandTotal || "120.00"), totalBoxX + boxWidth - 8, topRowY + 4, { align: "right" });

    // Total Content
    const totalContentY = topRowY + 25;
    doc.fontSize(8).font("Helvetica")
       .text("Total VAT EXCL", totalBoxX + 8, totalContentY)
       .text(formatCurrency(order.totalExclVat || "100.00"), totalBoxX + boxWidth - 8, totalContentY, { align: "right" })
       
       .text("VAT", totalBoxX + 8, totalContentY + 12)
       .text(formatCurrency(order.totalVat || "20.00"), totalBoxX + boxWidth - 8, totalContentY + 12, { align: "right" })
       
       .font("Helvetica-Bold")
       .text("Total VAT INCL", totalBoxX + 8, totalContentY + 24)
       .text(formatCurrency(order.grandTotal || "120.00"), totalBoxX + boxWidth - 8, totalContentY + 24, { align: "right" });

    // Bottom Row: Bank Details and Legal Text
    const bottomRowY = topRowY + 90;
    const bottomBoxWidth = (525 - 8) / 2;

    // Bank Details Box
    this.drawRoundedRect(doc, 30, bottomRowY, bottomBoxWidth, 60, borderRadius);
    doc.save();
    doc.rect(30, bottomRowY, bottomBoxWidth, 18).fill(primaryColor);
    doc.restore();
    this.drawRoundedRect(doc, 30, bottomRowY, bottomBoxWidth, 18, borderRadius);
    
    doc.fillColor("black")
       .fontSize(10)
       .font("Helvetica-Bold")
       .text("Bank Details", 30, bottomRowY + 4, { width: bottomBoxWidth, align: "center" });

    doc.fontSize(9).font("Helvetica-Bold")
       .text("BNP PARIBAS", 34, bottomRowY + 25);
    
    doc.fontSize(8).font("Helvetica")
       .text("IBAN", 34, bottomRowY + 37)
       .text(order.bankDetails?.iban || "FR76 3000 4000 0100 1234 5678 900", 34, bottomRowY + 45)
       .text("BIC BNPAFRPPXXX", 34, bottomRowY + 55);

    // Legal Text Box
    const legalBoxX = 30 + bottomBoxWidth + 8;
    this.drawRoundedRect(doc, legalBoxX, bottomRowY, bottomBoxWidth, 60, borderRadius);
    
    doc.fontSize(7)
       .font("Helvetica")
       .text("BENEKI conserve la propriété pleine et entière des marchandises jusqu'au complet paiement du prix suivant la loi 80.335 du 12 mai 1980. Pas d'escompte pour paiement anticipé. En cas de paiement hors délai, une pénalité égale à trois fois le taux de l'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de 40 Euros pour frais de recouvrement L-411-6 du Code de Commerce. Les conditions générales de ventes applicables sont disponibles sur notre site www.beneki.net", 
             legalBoxX + 8, bottomRowY + 8, { 
               width: bottomBoxWidth - 16, 
               align: "justify",
               lineGap: 1
             });

    // ===== COMPANY REGISTRATION FOOTER =====
    const companyFooterY = bottomRowY + 70;
    this.drawRoundedRect(doc, 30, companyFooterY, 525, 20, borderRadius);
    doc.save();
    doc.rect(30, companyFooterY, 525, 20).fill(primaryColor);
    doc.restore();
    this.drawRoundedRect(doc, 30, companyFooterY, 525, 20, borderRadius);
    
    doc.fillColor("black")
       .fontSize(7)
       .font("Helvetica-Bold")
       .text("BENEKI SARL / Capital 150 000€ / VAT Number: FR61889408019 / Siret 88940801900020 / APE 4690Z", 
             30, companyFooterY + 6, { width: 525, align: "center" });
  }

  // Helper function to draw rounded rectangles
  static drawRoundedRect(doc, x, y, width, height, radius) {
    doc.moveTo(x + radius, y)
       .lineTo(x + width - radius, y)
       .quadraticCurveTo(x + width, y, x + width, y + radius)
       .lineTo(x + width, y + height - radius)
       .quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
       .lineTo(x + radius, y + height)
       .quadraticCurveTo(x, y + height, x, y + height - radius)
       .lineTo(x, y + radius)
       .quadraticCurveTo(x, y, x + radius, y)
       .stroke();
  }

  static async generateAndSaveInvoice(orderData, filePath) {
    try {
      console.log("💾 Saving PDF to:", filePath);

      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      const pdfBuffer = await this.generateInvoicePDF(orderData);
      await fs.writeFile(filePath, pdfBuffer);

      console.log("✅ PDF saved successfully, size:", pdfBuffer.length, "bytes");
      return filePath;
    } catch (error) {
      console.error("❌ Error saving PDF:", error);
      throw error;
    }
  }
}

module.exports = { PDFKitService };