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

    // ===== PAGE NUMBER =====
    doc.fontSize(8)
      .fillColor("#666")
      .text("Page 1/1", 495, 30, { align: "right" });

    // ===== HEADER SECTION =====
    // Left Section - Company Info with Logo
    // Note: Logo commented out - uncomment if you have the logo file
    // doc.image(path.join(__dirname, '../../public/logo9.png'), 30, 30, { width: 180, height: 60 });

    doc.fontSize(11)
      .fillColor("black")
      .font("Helvetica")
      .text("691 rue Maurice Caullery", 30, 100)
      .text("59500 Douai", 30, 114)
      .text("FRANCE", 30, 128)
      .text("www.beneki.net", 30, 142)
      .text("Tel. 03 74 09 81 86", 30, 156);

    // Right Section - Invoice Info
    doc.font("Helvetica-Bold")
      .fontSize(14)
      .text("INVOICE", 350, 30);

    doc.font("Helvetica")
      .fontSize(9)
      .text(`N° ${order.invoiceNumber}`, 350, 55)
      .text(`Date : ${order.invoiceDate}`, 350, 67);

    doc.font("Helvetica-Bold")
      .text("Customer Company Name", 350, 85);

    doc.font("Helvetica")
      .text(order.customerCompany || "N/A", 350, 97)
      .text(order.customerAddress || "N/A", 350, 109)
      .text(order.customerCity || "N/A", 350, 121)
      .text(order.customerCountry || "N/A", 350, 133);

    doc.text(`Client ref : ${order.clientRef || "N/A"}`, 350, 151)
      .text(`Email : ${order.clientEmail || "N/A"}`, 350, 163)
      .text(`TVA Intracom : ${order.customerVAT || "N/A"}`, 350, 175);

    // ===== DELIVERY ADDRESS SECTION =====
    const deliveryY = 200;
    this.drawRoundedRect(doc, 30, deliveryY, 525, 50, borderRadius);

    // Section Title
    doc.rect(30, deliveryY, 525, 15).fillAndStroke(primaryColor, primaryColor);
    doc.fillColor("black")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Delivery address :", 35, deliveryY + 3);

    // Address Content
    doc.fillColor("black")
      .fontSize(9)
      .font("Helvetica")
      .text(order.deliveryName || "N/A", 35, deliveryY + 20)
      .text(order.deliveryAddress || "N/A", 35, deliveryY + 32)
      .text(order.deliveryPhone || "N/A", 35, deliveryY + 44);

    // ===== PRODUCTS TABLE SECTION =====
    const tableY = deliveryY + 70;
    this.drawRoundedRect(doc, 30, tableY, 525, 200, borderRadius);

    // Table column widths (same as React version)
    const colWidths = {
      reference: 525 * 0.12,    // 12%
      product: 525 * 0.32,      // 32%
      qty: 525 * 0.10,          // 10%
      price: 525 * 0.18,        // 18%
      total: 525 * 0.18,        // 18%
      vat: 525 * 0.10,          // 10%
    };

    // Table Header with rounded corners
    doc.rect(30, tableY, 525, 20).fillAndStroke(primaryColor, primaryColor);

    // First header cell with left border radius
    doc.rect(30, tableY, colWidths.reference, 20).fillAndStroke(primaryColor, primaryColor);

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
    doc.fillColor("black").fontSize(8).font("Helvetica");

    if (products.length > 0) {
      products.forEach((product, index) => {
        if (currentY > tableY + 180) return; // Prevent overflow

        doc.rect(30, currentY, 525, 18).stroke();
        doc.text(product.reference || "-", 34, currentY + 5)
          .text(product.name || "-", 30 + colWidths.reference + 4, currentY + 5)
          .text(product.qty?.toString() || "-", 30 + colWidths.reference + colWidths.product + 4, currentY + 5)
          .text(product.unitPrice || "-", 30 + colWidths.reference + colWidths.product + colWidths.qty + 4, currentY + 5)
          .text(product.totalExclVat || "-", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4, currentY + 5)
          .text(`${product.vatRate || 0}%`, 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 4, currentY + 5);

        currentY += 18;
      });
    } else {
      // Fill with empty rows like React version
      for (let i = 0; i < 10; i++) {
        if (currentY > tableY + 180) break;

        doc.rect(30, currentY, 525, 18).stroke();
        doc.text("-", 34, currentY + 5)
          .text("-", 30 + colWidths.reference + 4, currentY + 5)
          .text("-", 30 + colWidths.reference + colWidths.product + 4, currentY + 5)
          .text("-", 30 + colWidths.reference + colWidths.product + colWidths.qty + 4, currentY + 5)
          .text("-", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4, currentY + 5)
          .text("-", 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 4, currentY + 5);

        currentY += 18;
      }
    }

    // ===== FOOTER SECTION =====
    const footerY = tableY + 210;

    // Top Row: Payment Type, VAT, Total
    const topRowY = footerY;
    const boxWidth = (525 - 16) / 3; // 3 boxes with 8px gap

    // Payment Type Box
    this.drawRoundedRect(doc, 30, topRowY, boxWidth, 80, borderRadius);
    doc.rect(30, topRowY, boxWidth, 18).fillAndStroke(primaryColor, primaryColor);
    doc.fillColor("black")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Payment Type", 34, topRowY + 4);

    doc.fontSize(9).font("Helvetica");
    let paymentY = topRowY + 25;
    if (paymentData.length > 0) {
      paymentData.forEach((payment, index) => {
        doc.text(payment.paymentType || "Bank Transfer", 34, paymentY);
        paymentY += 12;
      });
    } else {
      doc.text("Bank Transfer", 34, paymentY);
    }

    // VAT Breakdown Box
    const vatBoxX = 30 + boxWidth + 8;
    this.drawRoundedRect(doc, vatBoxX, topRowY, boxWidth, 80, borderRadius);
    doc.rect(vatBoxX, topRowY, boxWidth, 18).fillAndStroke(primaryColor, primaryColor);

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
          .text(vat.base || "€ 74.7", vatBoxX + vatColWidth, vatContentY, { align: "center" })
          .text(vat.total || "€ 14.94", vatBoxX + vatColWidth * 2, vatContentY, { align: "center" });
        vatContentY += 10;
      });
    } else {
      // Default VAT data like React version
      doc.fontSize(8).font("Helvetica")
        .text("20%", vatBoxX + 4, vatContentY)
        .text("€ 74.7", vatBoxX + vatColWidth, vatContentY, { align: "center" })
        .text("€ 14.94", vatBoxX + vatColWidth * 2, vatContentY, { align: "center" });

      vatContentY += 10;
      doc.text("5.5%", vatBoxX + 4, vatContentY)
        .text("€ 48.76", vatBoxX + vatColWidth, vatContentY, { align: "center" })
        .text("€ 2.68", vatBoxX + vatColWidth * 2, vatContentY, { align: "center" });
    }

    const formatCurrency = (value) => {
  if (!value && value !== 0) return "€ 0.00";
  if (typeof value === 'string' && value.includes('€')) {
    return value.replace('€', '€ ').replace('  ', ' ');
  }
  const numericValue = typeof value === 'string' ? value.replace('€', '').trim() : value;
  return `€ ${parseFloat(numericValue).toFixed(2)}`;
};

// Total Box
const totalBoxX = vatBoxX + boxWidth + 8;
this.drawRoundedRect(doc, totalBoxX, topRowY, boxWidth, 80, borderRadius);

// Total Header with background
doc.save();
doc.rect(totalBoxX, topRowY, boxWidth, 18).fill(primaryColor);
doc.restore();
this.drawRoundedRect(doc, totalBoxX, topRowY, boxWidth, 18, borderRadius);

// Total Header text - FIXED: Don't chain text calls with alignment
doc.fillColor("black")
   .fontSize(10)
   .font("Helvetica-Bold");

// Header - TOTAL label and amount on separate calls
doc.text("TOTAL", totalBoxX + 8, topRowY + 4);
doc.text(formatCurrency(order.grandTotal || "120.00"), totalBoxX, topRowY + 4, { 
  width: boxWidth - 8, 
  align: "right" 
});

// Total Content - FIXED: Each line as separate calls
const totalContentY = topRowY + 25;
const lineHeight = 12;

// Line 1: Total VAT EXCL
doc.fontSize(8).font("Helvetica");
doc.text("Total VAT EXCL", totalBoxX + 8, totalContentY);
doc.text(formatCurrency(order.totalExclVat || "100.00"), totalBoxX, totalContentY, { 
  width: boxWidth - 8, 
  align: "right" 
});

// Line 2: VAT
doc.text("VAT", totalBoxX + 8, totalContentY + lineHeight);
doc.text(formatCurrency(order.totalVat || "20.00"), totalBoxX, totalContentY + lineHeight, { 
  width: boxWidth - 8, 
  align: "right" 
});

// Line 3: Total VAT INCL
doc.font("Helvetica-Bold");
doc.text("Total VAT INCL", totalBoxX + 8, totalContentY + (lineHeight * 2));
doc.text(formatCurrency(order.grandTotal || "120.00"), totalBoxX, totalContentY + (lineHeight * 2), { 
  width: boxWidth - 8, 
  align: "right" 
});
    // Bottom Row: Bank Details and Legal Text
    const bottomRowY = topRowY + 90;
    const bottomBoxWidth = (525 - 8) / 2;

    // Bank Details Box
    this.drawRoundedRect(doc, 30, bottomRowY, bottomBoxWidth, 60, borderRadius);
    doc.rect(30, bottomRowY, bottomBoxWidth, 18).fillAndStroke(primaryColor, primaryColor);
    doc.fillColor("black")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Bank Details", 30, bottomRowY + 4, { width: bottomBoxWidth, align: "center" });

    doc.fontSize(9).font("Helvetica-Bold")
      .text("BNP PARIBAS", 34, bottomRowY + 25);

    doc.fontSize(8).font("Helvetica")
      .text("IBAN", 34, bottomRowY + 37)
      .text(order.bankDetails?.iban || "FR76 3000 4013 8200 0100 7237 994", 34, bottomRowY + 45)
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
    doc.rect(30, companyFooterY, 525, 20).fillAndStroke(primaryColor, primaryColor);

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