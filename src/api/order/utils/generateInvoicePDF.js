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

  // ===== HEADER SECTION - Exact like reference image =====
  // Company Info (Left)
  doc
    .fontSize(11)
    .fillColor(black)
    .text("BENEKI", 30, 60)
    .text("691 rue Maurice Caullery", 30, 75)
    .text("59500 Douai", 30, 88)
    .text("FRANCE", 30, 101)
    .text("www.beneki.net", 30, 114)
    .text("Tel. 03 74 09 81 86", 30, 127);

  // Invoice Info (Right) - Exact positioning like reference
  const rightSectionX = 350;
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("INVOICE", rightSectionX, 60)
    .fontSize(9)
    .font("Helvetica")
    .text(`N° ${order.invoiceNumber}`, rightSectionX, 85)
    .text(`Date : ${order.invoiceDate}`, rightSectionX, 98);

  // Customer Info - Exact like reference
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("Customer Company Name", rightSectionX, 120)
    .font("Helvetica")
    .text(order.customerCompany, rightSectionX, 133)
    .text(order.customerAddress, rightSectionX, 146)
    .text(order.customerCity, rightSectionX, 159)
    .text(order.customerCountry, rightSectionX, 172)
    .text(`Client ref : ${order.clientRef}`, rightSectionX, 190)
    .text(`Email : ${order.clientEmail}`, rightSectionX, 203)
    .text(`TVA Intracom : ${order.customerVAT}`, rightSectionX, 216);

  // ===== DELIVERY ADDRESS SECTION =====
  const deliveryY = 250;
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
    .text(order.deliveryName, 35, deliveryY + 25)
    .text(order.deliveryAddress, 35, deliveryY + 38)
    .text(order.deliveryPhone, 35, deliveryY + 51);

  // ===== PRODUCTS TABLE =====
  const tableStartY = deliveryY + 70;
  let y = tableStartY;

  // Column widths (12%, 32%, 10%, 18%, 18%, 10%)
  const colWidths = {
    reference: 64,
    product: 171,
    qty: 54,
    price: 96,
    total: 96,
    vat: 54
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
  doc.text("Price VAT excluded", colPositions.price + 4, y + 4, { width: colWidths.price - 8 });
  doc.text("Total VAT excluded", colPositions.total + 4, y + 4, { width: colWidths.total - 8 });
  doc.text("VAT %", colPositions.vat + 4, y + 4, { width: colWidths.vat - 8 });

  y += 15;
  doc.fillColor(black);

  // Table rows
  const products = order.products || [];
  products.forEach((product, index) => {
    doc.moveTo(30, y).lineTo(565, y).stroke();
    
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(product.reference, colPositions.reference + 4, y + 4, { width: colWidths.reference - 8 })
      .text(product.name, colPositions.product + 4, y + 4, { width: colWidths.product - 8 })
      .text(String(product.qty), colPositions.qty + 4, y + 4, { width: colWidths.qty - 8 })
      .text(product.unitPrice, colPositions.price + 4, y + 4, { width: colWidths.price - 8 })
      .text(product.totalExclVat, colPositions.total + 4, y + 4, { width: colWidths.total - 8 })
      .text(`${product.vatRate}%`, colPositions.vat + 4, y + 4, { width: colWidths.vat - 8 });

    y += 15;
  });

  // Final table bottom line
  doc.moveTo(30, y).lineTo(565, y).stroke();

  // ===== TOTALS SECTION - Exact like reference image =====
  const totalsY = y + 20;

  // Payment Type Section (Left)
  const paymentSectionX = 30;
  const paymentSectionWidth = 257;

  doc
    .rect(paymentSectionX, totalsY, paymentSectionWidth, 18)
    .fill(green)
    .stroke()
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Payment Type", paymentSectionX + (paymentSectionWidth / 2), totalsY + 4, { align: "center" });

  let paymentY = totalsY + 18;
  doc.fillColor(black);

  // Payment row
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(order.paymentMethod, paymentSectionX + 10, paymentY + 6)
    .text(order.paymentData[0].amount, paymentSectionX + paymentSectionWidth - 40, paymentY + 6, { align: "right" });

  // Summary Table (Right) - Exact layout like reference
  const summarySectionX = 307;
  const summarySectionWidth = 258;

  // Summary rows
  const summaryRows = [
    { label: "TOTAL", value: order.grandTotal, bold: true, bgColor: "#f0f0f0" },
    { label: "Total VAT EXCL", value: order.totalExclVat, bold: false },
    { label: "VAT", value: order.totalVat, bold: false },
    { label: "Total VAT INCL", value: order.grandTotal, bold: true }
  ];

  let summaryY = totalsY;
  summaryRows.forEach((row, index) => {
    if (row.bgColor) {
      doc.rect(summarySectionX, summaryY, summarySectionWidth, 18).fill(row.bgColor).stroke();
    }
    
    const font = row.bold ? "Helvetica-Bold" : "Helvetica";
    doc
      .font(font)
      .fontSize(9)
      .fillColor(black)
      .text(row.label, summarySectionX + 10, summaryY + 6)
      .text(row.value, summarySectionX + summarySectionWidth - 40, summaryY + 6, { align: "right" });

    summaryY += 18;
  });

  // ===== BANK DETAILS =====
  const bankY = totalsY + 80;
  doc
    .rect(30, bankY, 535, 30)
    .stroke()
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("Bank Details", 35, bankY + 5)
    .font("Helvetica")
    .text("BNP PARIBAS", 35, bankY + 15)
    .text(`IBAN: ${order.bankDetails.iban}`, 35, bankY + 25)
    .text(`BIC: ${order.bankDetails.bic}`, 35, bankY + 35);

  // ===== FOOTER TEXT =====
  const footerY = bankY + 45;
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

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return filePath;
};