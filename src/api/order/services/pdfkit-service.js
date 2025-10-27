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

        // Build exact same UI as reference image
        this.buildExactReferenceUI(doc, order);

        doc.end();
      } catch (error) {
        console.error("❌ PDF generation error:", error);
        reject(error);
      }
    });
  }

  static buildExactReferenceUI(doc, order) {
    const products = order.products || [];
    const paymentData = order.paymentData || [];
    const vatBreakdown = order.vatBreakdown || [];
    
    const primaryColor = "#4e5f4b"; // Green background for headers
    const lightGray = "#f8f8f8";

    // ===== HEADER SECTION =====
    // Left: Company Info
    doc.fontSize(10)
       .fillColor("black")
       .font("Helvetica-Bold")
       .text("BENEKI", 30, 30)
       .font("Helvetica")
       .text("HOSTING MADE EASY", 30, 44);
    
    doc.fontSize(9)
       .text("691 rue Maurice Caullery", 30, 62)
       .text("59500 Douai", 30, 74)
       .text("FRANCE", 30, 86)
       .text("www.beneki.net", 30, 98)
       .text("Tel. 03 74 09 81 86", 30, 110);

    // Horizontal line
    doc.moveTo(30, 125).lineTo(565, 125).stroke();

    // Center: INVOICE title
    doc.font("Helvetica-Bold")
       .fontSize(16)
       .text("INVOICE", 0, 40, { align: "center" });

    // Right: Invoice Info
    const rightX = 400;
    doc.font("Helvetica")
       .fontSize(9)
       .text(`N° ${order.invoiceNumber}`, rightX, 50)
       .text(`Date : ${order.invoiceDate}`, rightX, 62);

    // Second horizontal line
    doc.moveTo(30, 140).lineTo(565, 140).stroke();

    // ===== CUSTOMER INFO SECTION =====
    const customerY = 150;
    
    // Customer Company Name header
    doc.font("Helvetica-Bold")
       .fontSize(10)
       .text("Customer Company Name", 30, customerY);
    
    // Customer details
    doc.font("Helvetica")
       .fontSize(9)
       .text(order.customerCompany || "N/A", 30, customerY + 14)
       .text(order.customerAddress || "N/A", 30, customerY + 26)
       .text(order.customerCity || "N/A", 30, customerY + 38)
       .text(order.customerCountry || "N/A", 30, customerY + 50);
    
    doc.text(`Client ref : ${order.clientRef || "N/A"}`, 30, customerY + 64)
       .text(`Email : ${order.clientEmail || "N/A"}`, 30, customerY + 76)
       .text(`TVA Intracom : ${order.customerVAT || "N/A"}`, 30, customerY + 88);

    // ===== DELIVERY ADDRESS SECTION =====
    const deliveryY = customerY + 110;
    
    // Section header with underline
    doc.font("Helvetica-Bold")
       .fontSize(10)
       .text("Delivery address :", 30, deliveryY);
    
    // Small underline
    doc.moveTo(30, deliveryY + 12).lineTo(150, deliveryY + 12).stroke();

    // Delivery details
    doc.font("Helvetica")
       .fontSize(9)
       .text(order.deliveryName || "N/A", 30, deliveryY + 20)
       .text(order.deliveryAddress || "N/A", 30, deliveryY + 32)
       .text(order.deliveryPhone || "N/A", 30, deliveryY + 44);

    // ===== PRODUCTS TABLE =====
    const tableY = deliveryY + 70;
    
    // Table Header
    doc.rect(30, tableY, 525, 20).fillAndStroke(primaryColor, primaryColor);
    
    // Column widths matching reference
    const colWidths = {
      reference: 525 * 0.15,
      product: 525 * 0.30,
      qty: 525 * 0.10,
      price: 525 * 0.20,
      total: 525 * 0.15,
      vat: 525 * 0.10,
    };

    doc.fillColor("black")
       .fontSize(9)
       .font("Helvetica-Bold")
       .text("Reference", 34, tableY + 6)
       .text("Product", 30 + colWidths.reference + 4, tableY + 6)
       .text("Qty", 30 + colWidths.reference + colWidths.product + 4, tableY + 6)
       .text("Price VAT Excluded", 30 + colWidths.reference + colWidths.product + colWidths.qty + 4, tableY + 6)
       .text("Total VAT Excluded", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4, tableY + 6)
       .text("VAT %", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 4, tableY + 6);

    // Table Rows
    let currentY = tableY + 20;
    doc.fillColor("black").fontSize(8).font("Helvetica");
    
    if (products.length > 0) {
      products.forEach((product, index) => {
        // Alternate row background
        if (index % 2 === 0) {
          doc.rect(30, currentY, 525, 18).fillAndStroke(lightGray, lightGray);
        } else {
          doc.rect(30, currentY, 525, 18).stroke();
        }
        
        doc.fillColor("black")
           .text(product.reference || "-", 34, currentY + 5)
           .text(product.name || "-", 30 + colWidths.reference + 4, currentY + 5)
           .text(product.qty?.toString() || "-", 30 + colWidths.reference + colWidths.product + 4, currentY + 5)
           .text(product.unitPrice || "-", 30 + colWidths.reference + colWidths.product + colWidths.qty + 4, currentY + 5)
           .text(product.totalExclVat || "-", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4, currentY + 5)
           .text(`${product.vatRate || 0}%`, 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 4, currentY + 5);
        
        currentY += 18;
      });
    } else {
      // Single row for no products
      doc.rect(30, currentY, 525, 18).fillAndStroke(lightGray, lightGray);
      doc.text("No products", 34, currentY + 5);
      currentY += 18;
    }

    // ===== FOOTER SECTION =====
    const footerY = currentY + 20;

    // Left: Payment Type
    const leftBoxWidth = 160;
    doc.rect(30, footerY, leftBoxWidth, 80).stroke();
    
    // Payment Type Header
    doc.rect(30, footerY, leftBoxWidth, 20).fillAndStroke(primaryColor, primaryColor);
    doc.fillColor("black")
       .fontSize(10)
       .font("Helvetica-Bold")
       .text("Payment Type:", 34, footerY + 6);

    // Payment content
    let paymentY = footerY + 25;
    if (paymentData.length > 0) {
      paymentData.forEach((payment, index) => {
        doc.fontSize(9).font("Helvetica")
           .text(payment.paymentType || "Bank Transfer", 34, paymentY);
        paymentY += 12;
      });
    } else {
      doc.fontSize(9).font("Helvetica")
         .text("Bank Transfer", 34, paymentY);
    }

    // Middle: VAT Breakdown
    const vatBoxX = 30 + leftBoxWidth + 10;
    const vatBoxWidth = 140;
    doc.rect(vatBoxX, footerY, vatBoxWidth, 80).stroke();
    
    // VAT Header
    doc.rect(vatBoxX, footerY, vatBoxWidth, 20).fillAndStroke(primaryColor, primaryColor);
    
    const vatColWidth = vatBoxWidth / 3;
    doc.fillColor("black")
       .fontSize(9)
       .font("Helvetica-Bold")
       .text("VAT", vatBoxX + 4, footerY + 6)
       .text("Base", vatBoxX + vatColWidth, footerY + 6, { align: "center" })
       .text("Total", vatBoxX + vatColWidth * 2, footerY + 6, { align: "center" });

    // VAT Content
    let vatContentY = footerY + 25;
    if (vatBreakdown.length > 0) {
      vatBreakdown.forEach((vat, index) => {
        doc.fontSize(8).font("Helvetica")
           .text(vat.rate || "20%", vatBoxX + 4, vatContentY)
           .text(vat.base || "€ 99.90", vatBoxX + vatColWidth, vatContentY, { align: "center" })
           .text(vat.total || "€ 19.98", vatBoxX + vatColWidth * 2, vatContentY, { align: "center" });
        vatContentY += 10;
      });
    } else {
      // Calculate VAT breakdown from products
      const vatGroups = {};
      products.forEach(product => {
        const rate = product.vatRate || 20;
        const base = parseFloat(product.totalExclVat?.replace('€', '').replace(',', '').trim()) || 0;
        const total = base * (rate / 100);
        
        if (!vatGroups[rate]) {
          vatGroups[rate] = { base: 0, total: 0 };
        }
        vatGroups[rate].base += base;
        vatGroups[rate].total += total;
      });

      // Display VAT breakdown
      Object.keys(vatGroups).forEach(rate => {
        const vat = vatGroups[rate];
        doc.fontSize(8).font("Helvetica")
           .text(`${rate}%`, vatBoxX + 4, vatContentY)
           .text(`€ ${vat.base.toFixed(2)}`, vatBoxX + vatColWidth, vatContentY, { align: "center" })
           .text(`€ ${vat.total.toFixed(2)}`, vatBoxX + vatColWidth * 2, vatContentY, { align: "center" });
        vatContentY += 10;
      });

      // Default if no products
      if (Object.keys(vatGroups).length === 0) {
        doc.fontSize(8).font("Helvetica")
           .text("20%", vatBoxX + 4, vatContentY)
           .text("€ 99.90", vatBoxX + vatColWidth, vatContentY, { align: "center" })
           .text("€ 19.98", vatBoxX + vatColWidth * 2, vatContentY, { align: "center" });
      }
    }

    // Right: Totals
    const totalBoxX = vatBoxX + vatBoxWidth + 10;
    const totalBoxWidth = 185;
    doc.rect(totalBoxX, footerY, totalBoxWidth, 80).stroke();
    
    // Total Header
    doc.rect(totalBoxX, footerY, totalBoxWidth, 20).fillAndStroke(primaryColor, primaryColor);
    doc.fillColor("black")
       .fontSize(10)
       .font("Helvetica-Bold")
       .text("TOTAL", totalBoxX + 8, footerY + 6)
       .text(order.grandTotal || "€ 213.78", totalBoxX + totalBoxWidth - 8, footerY + 6, { align: "right" });

    // Total Content
    const totalContentY = footerY + 25;
    doc.fontSize(9).font("Helvetica")
       .text("Total VAT EXCL", totalBoxX + 8, totalContentY)
       .text(order.totalExclVat || "€ 188.90", totalBoxX + totalBoxWidth - 8, totalContentY, { align: "right" })
       
       .text("VAT", totalBoxX + 8, totalContentY + 15)
       .text(order.totalVat || "€ 24.88", totalBoxX + totalBoxWidth - 8, totalContentY + 15, { align: "right" })
       
       .font("Helvetica-Bold")
       .text("Total VAT INCL", totalBoxX + 8, totalContentY + 30)
       .text(order.grandTotal || "€ 213.78", totalBoxX + totalBoxWidth - 8, totalContentY + 30, { align: "right" });

    // ===== BANK DETAILS SECTION =====
    const bankY = footerY + 90;
    
    doc.rect(30, bankY, 525, 50).stroke();
    
    // Bank Header
    doc.rect(30, bankY, 525, 20).fillAndStroke(primaryColor, primaryColor);
    doc.fillColor("black")
       .fontSize(10)
       .font("Helvetica-Bold")
       .text("Bank Details", 34, bankY + 6);

    // Bank Content
    doc.fontSize(9).font("Helvetica-Bold")
       .text("BNP PARIBAS", 34, bankY + 25);
    
    doc.fontSize(8).font("Helvetica")
       .text("IBAN", 34, bankY + 38)
       .text(order.bankDetails?.iban || "FR76 3000 4013 8200 0100 7237 994", 34, bankY + 46)
       .text("BIC BNPAFRPPXXX", 200, bankY + 38);

    // ===== COMPANY FOOTER =====
    const companyFooterY = bankY + 60;
    
    doc.fontSize(7)
       .font("Helvetica")
       .text("BENEKI SARL / Capital 150 000€ / VAT Number: FR61889408019 / Siret 88940801900020 / APE 4690Z", 
             30, companyFooterY, { width: 525, align: "center" });
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