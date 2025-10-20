// @ts-nocheck
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

module.exports = async function generateInvoicePDF(order) {
  // Ensure tmp directory exists
  const tmpDir = path.join(__dirname, "../../tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const filePath = path.join(tmpDir, `invoice-${order.id}.pdf`);
  const doc = new PDFDocument({ margin: 30, size: "A4" });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const green = "#4e5f4b";
  const black = "#000000";

  // ===== HEADER SECTION - Matching React layout =====
  // Left Section - Company Info with Logo
  doc
    .fontSize(11)
    .fillColor(black)
    .text("691 rue Maurice Caullery", 30, 60)
    .text("59500 Douai", 30, 71)
    .text("FRANCE", 30, 82)
    .text("www.beneki.net", 30, 93)
    .text("Tel. 03 74 09 81 86", 30, 104);

  // Right Section - Invoice Info
  const rightSectionX = 350;
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("INVOICE", rightSectionX, 60)
    .fontSize(9)
    .font("Helvetica")
    .text(`N° ${order.invoiceNumber || order.id}`, rightSectionX, 85)
    .text(`Date : ${order.invoiceDate || new Date(order.createdAt).toLocaleDateString()}`, rightSectionX, 96);

  // Customer Info
  doc
    .font("Helvetica-Bold")
    .text("Customer Company Name", rightSectionX, 115)
    .font("Helvetica")
    .text(order.customerCompany || order.user?.username || "N/A", rightSectionX, 126)
    .text(order.customerAddress || "", rightSectionX, 137)
    .text(order.customerCity || "", rightSectionX, 148)
    .text(order.customerCountry || "", rightSectionX, 159)
    .text(`Client ref : ${order.clientRef || ""}`, rightSectionX, 175)
    .text(`Email : ${order.clientEmail || ""}`, rightSectionX, 186)
    .text(`TVA Intracom : ${order.customerVAT || "N/A"}`, rightSectionX, 197);

  // ===== DELIVERY ADDRESS SECTION - Like React =====
  const deliveryY = 220;
  doc
    .rect(30, deliveryY, 535, 18)
    .fill(green)
    .stroke()
    .fillColor("white")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Delivery address :", 35, deliveryY + 3)
    .fillColor(black)
    .font("Helvetica")
    .fontSize(9)
    .text(order.deliveryName || "N/A", 35, deliveryY + 25)
    .text(order.deliveryAddress || "N/A", 35, deliveryY + 38)
    .text(order.deliveryPhone || "N/A", 35, deliveryY + 51);

  if (order.deliveryNote) {
    doc.text(`Note: ${order.deliveryNote}`, 35, deliveryY + 64);
  }

  // ===== PRODUCTS TABLE - Exact column widths like React =====
  const tableStartY = order.deliveryNote ? deliveryY + 80 : deliveryY + 70;
  let y = tableStartY;

  // Table header with exact React column widths
  const colWidths = {
    reference: 67, // 12% of 535
    product: 171,   // 32% of 535
    qty: 54,       // 10% of 535
    price: 96,      // 18% of 535
    total: 96,      // 18% of 535
    vat: 54        // 10% of 535
  };

  const colPositions = {
    reference: 30,
    product: 30 + colWidths.reference,
    qty: 30 + colWidths.reference + colWidths.product,
    price: 30 + colWidths.reference + colWidths.product + colWidths.qty,
    total: 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price,
    vat: 30 + colWidths.reference + colWidths.product + colWidths.qty + colWidths.price + colWidths.total
  };

  // Table header
  doc
    .rect(30, y, 535, 15)
    .fill(green)
    .stroke()
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(8);

  doc.text("Reference", colPositions.reference + 4, y + 4, { width: colWidths.reference - 8 });
  doc.text("Product", colPositions.product + 4, y + 4, { width: colWidths.product - 8 });
  doc.text("Qty", colPositions.qty + 4, y + 4, { width: colWidths.qty - 8 });
  doc.text("Price VAT Excluded", colPositions.price + 4, y + 4, { width: colWidths.price - 8 });
  doc.text("Total VAT Excluded", colPositions.total + 4, y + 4, { width: colWidths.total - 8 });
  doc.text("VAT %", colPositions.vat + 4, y + 4, { width: colWidths.vat - 8 });

  y += 15;
  doc.fillColor(black);

  // Table rows
  const products = order.products || order.items || [
    {
      reference: "B3002ITCAR",
      name: "Product name + variation",
      qty: 3,
      unitPrice: "24.90 €",
      totalExclVat: "74.70 €",
      vatRate: 20,
    },
    {
      reference: "B3002ITV",
      name: "Product name",
      qty: 1,
      unitPrice: "48.76 €",
      totalExclVat: "48.76 €",
      vatRate: 5.5,
    },
  ];

  products.forEach((product, index) => {
    // Draw horizontal line
    doc.moveTo(30, y).lineTo(565, y).stroke();
    
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(product.reference || "-", colPositions.reference + 4, y + 4, { width: colWidths.reference - 8 })
      .text(product.name || "-", colPositions.product + 4, y + 4, { width: colWidths.product - 8 })
      .text(String(product.qty || product.quantity || 0), colPositions.qty + 4, y + 4, { width: colWidths.qty - 8 })
      .text(product.unitPrice || "-", colPositions.price + 4, y + 4, { width: colWidths.price - 8 })
      .text(product.totalExclVat || "-", colPositions.total + 4, y + 4, { width: colWidths.total - 8 })
      .text(`${product.vatRate}%`, colPositions.vat + 4, y + 4, { width: colWidths.vat - 8 });

    y += 15;
  });

  // Final table bottom line
  doc.moveTo(30, y).lineTo(565, y).stroke();

  // ===== TOTALS SECTION - Matching React layout =====
  const totalsY = y + 20;

  // Payment Type Section (Left)
  const paymentSectionX = 30;
  const paymentSectionWidth = 257; // ~48% of page width

  doc
    .rect(paymentSectionX, totalsY, paymentSectionWidth, 18)
    .fill(green)
    .stroke()
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Payment Type", paymentSectionX + 85, totalsY + 4, { align: "center" });

  let paymentY = totalsY + 18;
  doc.fillColor(black);

  const paymentData = order.paymentData || [
    { paymentType: "Credit Card", amount: "141.08 €" }
  ];

  paymentData.forEach((payment, index) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(payment.paymentType, paymentSectionX + 10, paymentY + 6)
      .text(payment.amount, paymentSectionX + paymentSectionWidth - 40, paymentY + 6, { align: "right" });

    // Draw separator line
    if (index < paymentData.length - 1) {
      doc.moveTo(paymentSectionX, paymentY + 18).lineTo(paymentSectionX + paymentSectionWidth, paymentY + 18).stroke();
    }
    paymentY += 18;
  });

  // VAT Breakdown
  const vatBreakdown = order.vatBreakdown || [
    { rate: "20.00%", base: "74.70 €", total: "14.94 €" },
    { rate: "5.50%", base: "48.76 €", total: "2.68 €" }
  ];

  const vatStartY = paymentY + 10;
  let vatY = vatStartY;

  vatBreakdown.forEach((vat, index) => {
    doc
      .font("Helvetica")
      .fontSize(8)
      .text("VAT", paymentSectionX + 10, vatY)
      .text(vat.rate, paymentSectionX + paymentSectionWidth - 40, vatY, { align: "right" })
      .text("Base", paymentSectionX + 10, vatY + 10)
      .text(vat.base, paymentSectionX + paymentSectionWidth - 40, vatY + 10, { align: "right" })
      .text("Total", paymentSectionX + 10, vatY + 20)
      .text(vat.total, paymentSectionX + paymentSectionWidth - 40, vatY + 20, { align: "right" });

    vatY += 35;
  });

  // Summary Table (Right)
  const summarySectionX = 307;
  const summarySectionWidth = 258;

  doc
    .rect(summarySectionX, totalsY, summarySectionWidth, 18)
    .fill("#f0f0f0")
    .stroke()
    .fillColor(black)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("TOTAL", summarySectionX + 10, totalsY + 6)
    .text(order.grandTotal || "141.08 €", summarySectionX + summarySectionWidth - 40, totalsY + 6, { align: "right" });

  let summaryY = totalsY + 18;

  const summaryRows = [
    { label: "Total VAT EXCL", value: order.totalExclVat || "123.46 €", bold: false },
    { label: "VAT", value: order.totalVat || "17.62 €", bold: false },
    { label: "Total VAT INCL", value: order.grandTotal || "141.08 €", bold: true }
  ];

  summaryRows.forEach((row, index) => {
    const font = row.bold ? "Helvetica-Bold" : "Helvetica";
    doc
      .font(font)
      .fontSize(9)
      .text(row.label, summarySectionX + 10, summaryY + 6)
      .text(row.value, summarySectionX + summarySectionWidth - 40, summaryY + 6, { align: "right" });

    if (index < summaryRows.length - 1) {
      doc.moveTo(summarySectionX, summaryY + 18).lineTo(summarySectionX + summarySectionWidth, summaryY + 18).stroke();
    }
    summaryY += 18;
  });

  // ===== BANK DETAILS =====
  const bankY = Math.max(vatY, summaryY) + 20;
  doc
    .rect(30, bankY, 535, 35)
    .stroke()
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("Bank Details", 35, bankY + 5)
    .font("Helvetica")
    .text("BNP PARIBAS", 35, bankY + 15)
    .text(`IBAN: ${order.bankDetails?.iban || "FR76 3000 4000 0100 1234 5678 900"}`, 35, bankY + 25)
    .text(`BIC: ${order.bankDetails?.bic || "BNPAFRPP"}`, 35, bankY + 35);

  // ===== FOOTER TEXT =====
  const footerY = bankY + 50;
  doc
    .fontSize(7)
    .fillColor(black)
    .text(
      "BENEKI conserve la propriété pleine et entière des marchandises jusqu'au complet paiement du prix suivant la loi 80.335 du 12 mai 1980. Pas d'escompte pour paiement anticipé. En cas de paiement hors délai, une pénalité égale à trois fois le taux de l'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de 40 €uros pour frais de recouvrement L-411-6 du Code de Commerce. Les conditions générales de ventes applicables sont disponibles sur notre site www.beneki.net",
      30,
      footerY,
      { width: 535, align: "justify", lineGap: 1 }
    );

  // ===== LEGAL FOOTER =====
  const legalFooterY = footerY + 40;
  doc
    .moveTo(30, legalFooterY).lineTo(565, legalFooterY).stroke()
    .fontSize(7)
    .text(
      "BENEKI SARL / Capital 150 000€ / VAT Number : FR61889408019 / Siret 88940801900020 / APE 4690Z",
      30,
      legalFooterY + 5,
      { width: 535, align: "center" }
    );

  // ===== PAGE INFO =====
  doc
    .fontSize(8)
    .fillColor("#666")
    .text("Page 1/1", 475, 30, { align: "right" });

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return filePath;
};