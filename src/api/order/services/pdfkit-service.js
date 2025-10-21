"use strict";

const PDFDocument = require("pdfkit");
const fs = require("fs").promises;
const path = require("path");

class PDFKitService {
  static async generateInvoicePDF(order) {
    return new Promise((resolve, reject) => {
      try {
        console.log("📄 Generating modern styled PDF for order:", order.invoiceNumber);

        const doc = new PDFDocument({
          margin: 30,
          size: "A4",
        });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Build styled PDF
        this.buildExactInvoicePDF(doc, order);

        doc.end();
      } catch (error) {
        console.error("❌ PDF generation error:", error);
        reject(error);
      }
    });
  }

  static buildExactInvoicePDF(doc, order) {
    const products = order.products || [];
    const paymentData = order.paymentData || [];
    const vatBreakdown = order.vatBreakdown || [];

    const primaryColor = "#4e5f4b";
    const grayBg = "#f0f0f0";

    // ===== HEADER =====
    // Optional Logo (uncomment if logo path exists)
    // doc.image(path.join(__dirname, 'logo9.png'), 50, 40, { width: 120 });

    // Left: Company Info
    doc.fontSize(11)
      .font("Helvetica")
      .text("691 rue Maurice Caullery", 50, 110)
      .text("59500 Douai", 50, 124)
      .text("FRANCE", 50, 138)
      .text("www.beneki.net", 50, 152)
      .text("Tel. 03 74 09 81 86", 50, 166);

    // Right: Invoice Info
    doc.font("Helvetica-Bold")
      .fontSize(16)
      .text("INVOICE", 400, 50, { align: "right" });

    doc.font("Helvetica")
      .fontSize(9)
      .text(`N° ${order.invoiceNumber}`, 350, 75)
      .text(`Date : ${order.invoiceDate}`, 350, 87);

    doc.font("Helvetica-Bold").text("Customer Company Name", 350, 105);
    doc.font("Helvetica")
      .text(order.customerCompany || "N/A", 350, 117)
      .text(order.customerAddress || "N/A", 350, 129)
      .text(order.customerCity || "N/A", 350, 141)
      .text(order.customerCountry || "N/A", 350, 153);

    doc.text(`Client ref : ${order.clientRef || "N/A"}`, 350, 171)
      .text(`Email : ${order.clientEmail || "N/A"}`, 350, 183)
      .text(`TVA Intracom : ${order.customerVAT || "N/A"}`, 350, 195);

    // ===== DELIVERY ADDRESS =====
    const deliveryY = 220;
    doc.rect(50, deliveryY, 495, 60).stroke();

    // Header
    doc.rect(50, deliveryY, 495, 18).fillAndStroke(primaryColor, primaryColor);
    doc.fillColor("white")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Delivery address :", 58, deliveryY + 4);

    // Address
    doc.fillColor("black").fontSize(9).font("Helvetica");
    doc.text(order.deliveryName || "N/A", 58, deliveryY + 25);
    doc.text(order.deliveryAddress || "N/A", 58, deliveryY + 37);
    if (order.deliveryPhone && order.deliveryPhone !== "N/A") {
      doc.text(order.deliveryPhone, 58, deliveryY + 49);
    }

    // ===== PRODUCTS TABLE =====
    const tableY = deliveryY + 70;
    const colWidths = {
      reference: 495 * 0.12,
      product: 495 * 0.32,
      qty: 495 * 0.10,
      price: 495 * 0.18,
      total: 495 * 0.18,
      vat: 495 * 0.10,
    };

    // Header row
    doc.rect(50, tableY, 495, 18).fillAndStroke(primaryColor, primaryColor);
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold");
    doc.text("Reference", 52, tableY + 4);
    doc.text("Product", 50 + colWidths.reference + 4, tableY + 4);
    doc.text("Qty", 50 + colWidths.reference + colWidths.product + 4, tableY + 4);
    doc.text(
      "Price VAT Excluded",
      50 + colWidths.reference + colWidths.product + colWidths.qty + 4,
      tableY + 4
    );
    doc.text(
      "Total VAT Excluded",
      50 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4,
      tableY + 4
    );
    doc.text(
      "VAT %",
      50 +
        colWidths.reference +
        colWidths.product +
        colWidths.qty +
        colWidths.price +
        colWidths.total +
        4,
      tableY + 4
    );

    doc.fillColor("black").fontSize(8);
    let currentY = tableY + 18;

    // Table rows
    products.forEach((product, i) => {
      if (currentY > 650) {
        doc.addPage();
        currentY = 50;
      }

      doc.rect(50, currentY, 495, 18).stroke();
      doc.text(product.reference || "N/A", 52, currentY + 5);
      doc.text(product.name || "N/A", 50 + colWidths.reference + 4, currentY + 5);
      doc.text(product.qty?.toString() || "0", 50 + colWidths.reference + colWidths.product + 4, currentY + 5);
      doc.text(product.unitPrice || "0.00 €", 50 + colWidths.reference + colWidths.product + colWidths.qty + 4, currentY + 5);
      doc.text(product.totalExclVat || "0.00 €", 50 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + 4, currentY + 5);
      doc.text(`${product.vatRate || 0}%`, 50 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total + 4, currentY + 5);

      currentY += 18;
    });

    if (products.length === 0) {
      doc.rect(50, currentY, 495, 18).stroke();
      doc.text("No products", 52, currentY + 5);
      currentY += 18;
    }

    // ===== TOTALS SECTION =====
    const totalsY = currentY + 25;
    const sectionWidth = 240;
    const gap = 15;

    // Left: Payment Type
    doc.rect(50, totalsY, sectionWidth, 110).stroke();
    doc.rect(50, totalsY, sectionWidth, 18).fillAndStroke(primaryColor, primaryColor);
    doc.fillColor("white").fontSize(10).font("Helvetica-Bold").text("Payment Type", 50, totalsY + 4, {
      width: sectionWidth,
      align: "center",
    });

    doc.fillColor("black");
    let paymentY = totalsY + 18;

    paymentData.forEach((payment) => {
      doc.rect(50, paymentY, sectionWidth, 25).stroke();
      doc.fontSize(9).font("Helvetica-Bold");
      doc.text(payment.paymentType || "N/A", 56, paymentY + 8);
      doc.text(payment.amount || "0.00 €", 50 + sectionWidth - 56, paymentY + 8, { align: "right" });
      paymentY += 25;
    });

    if (vatBreakdown.length > 0) {
      const vatY = paymentY;
      vatBreakdown.forEach((vat) => {
        doc.fontSize(8).font("Helvetica");
        doc.text("VAT", 56, vatY + 5);
        doc.text(vat.rate || "0%", 50 + sectionWidth - 56, vatY + 5, { align: "right" });
        doc.text("Base", 56, vatY + 15);
        doc.text(vat.base || "0.00 €", 50 + sectionWidth - 56, vatY + 15, { align: "right" });
        doc.text("Total", 56, vatY + 25);
        doc.text(vat.total || "0.00 €", 50 + sectionWidth - 56, vatY + 25, { align: "right" });
      });
    }

    // Right: Summary
    const summaryX = 50 + sectionWidth + gap;
    doc.rect(summaryX, totalsY, sectionWidth, 110).stroke();

    const rowH = 25;

    // TOTAL (gray)
    doc.rect(summaryX, totalsY, sectionWidth, rowH).fillAndStroke(grayBg, "#000");
    doc.fillColor("black").fontSize(9).font("Helvetica-Bold");
    doc.text("TOTAL", summaryX + 6, totalsY + 8);
    doc.text(order.grandTotal || "0.00 €", summaryX + sectionWidth - 6, totalsY + 8, { align: "right" });

    // VAT Excl
    doc.fillColor("black").font("Helvetica");
    doc.rect(summaryX, totalsY + rowH, sectionWidth, rowH).stroke();
    doc.text("Total VAT EXCL", summaryX + 6, totalsY + rowH + 8);
    doc.text(order.totalExclVat || "0.00 €", summaryX + sectionWidth - 6, totalsY + rowH + 8, { align: "right" });

    // VAT
    doc.rect(summaryX, totalsY + rowH * 2, sectionWidth, rowH).stroke();
    doc.text("VAT", summaryX + 6, totalsY + rowH * 2 + 8);
    doc.text(order.totalVat || "0.00 €", summaryX + sectionWidth - 6, totalsY + rowH * 2 + 8, { align: "right" });

    // VAT Incl (bold)
    doc.rect(summaryX, totalsY + rowH * 3, sectionWidth, rowH).stroke();
    doc.font("Helvetica-Bold");
    doc.text("Total VAT INCL", summaryX + 6, totalsY + rowH * 3 + 8);
    doc.text(order.grandTotal || "0.00 €", summaryX + sectionWidth - 6, totalsY + rowH * 3 + 8, { align: "right" });

    // ===== BANK DETAILS =====
    const bankY = totalsY + 130;
    doc.rect(50, bankY, 495, 35).stroke();
    doc.fontSize(8).font("Helvetica-Bold").text("Bank Details", 56, bankY + 6);
    doc.font("Helvetica-Bold").text("BNP PARIBAS", 56, bankY + 18);
    doc.font("Helvetica")
      .text(`IBAN: ${order.bankDetails?.iban || "FR76 3000 4000 0100 1234 5678 900"}`, 180, bankY + 18)
      .text(`BIC: ${order.bankDetails?.bic || "BNPAFRPP"}`, 400, bankY + 18);

    // ===== FOOTER =====
    const footerY = bankY + 50;
    doc.fontSize(7).fillColor("black").font("Helvetica");
    doc.text(
      "BENEKI conserve la propriété pleine et entière des marchandises jusqu'au complet paiement du prix suivant la loi 80.335 du 12 mai 1980. Pas d'escompte pour paiement anticipé. En cas de paiement hors délai, une pénalité égale à trois fois le taux de l'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de 40 €uros pour frais de recouvrement L-411-6 du Code de Commerce. Les conditions générales de ventes applicables sont disponibles sur notre site www.beneki.net",
      50,
      footerY,
      { width: 495, align: "justify", lineGap: 1 }
    );

    const legalY = footerY + 35;
    doc.moveTo(50, legalY).lineTo(545, legalY).stroke();
    doc.fontSize(7).text(
      "BENEKI SARL / Capital 150 000€ / VAT Number : FR61889408019 / Siret 88940801900020 / APE 4690Z",
      50,
      legalY + 5,
      { width: 495, align: "center" }
    );

    // Page info
    doc.fontSize(8).fillColor("#666").text("Page 1/1", 545, 30, { align: "right" });
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
