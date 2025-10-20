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

  // ===== HEADER SECTION - Like Image 1 =====
  // Company Info (Left - 60% width)
  doc
    .fontSize(11)
    .fillColor(black)
    .text("BENEKI", 30, 60)
    .text("691 rue Maurice Caullery", 30, 75)
    .text("59500 Douai", 30, 88)
    .text("FRANCE", 30, 101)
    .text("www.beneki.net", 30, 114)
    .text("Tel. 03 74 09 81 86", 30, 127);

  // Invoice Info (Right - 35% width)
  const rightSectionX = 350;
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("INVOICE", rightSectionX, 60)
    .fontSize(9)
    .font("Helvetica")
    .text(`N° ${order.invoiceNumber || `ORD-${String(order.id).padStart(7, '0')}`}`, rightSectionX, 85)
    .text(`Date : ${order.invoiceDate || new Date(order.createdAt).toLocaleDateString('en-US')}`, rightSectionX, 98);

  // Customer Info
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("Customer Company Name", rightSectionX, 120)
    .font("Helvetica")
    .text(order.customerCompany || order.user?.company || "N/A", rightSectionX, 133)
    .text(order.customerAddress || order.user?.address || "N/A", rightSectionX, 146)
    .text(order.customerCity || order.user?.city || "N/A", rightSectionX, 159)
    .text(order.customerCountry || order.user?.country || "N/A", rightSectionX, 172)
    .text(`Client ref : ${order.clientRef || "N/A"}`, rightSectionX, 190)
    .text(`Email : ${order.clientEmail || order.user?.email || "N/A"}`, rightSectionX, 203)
    .text(`TVA Intracom : ${order.customerVAT || "N/A"}`, rightSectionX, 216);

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
    .text(order.deliveryName || order.shippingAddress?.name || "N/A", 35, deliveryY + 25)
    .text(order.deliveryAddress || order.shippingAddress?.address || "N/A", 35, deliveryY + 38)
    .text(order.deliveryPhone || order.shippingAddress?.phone || "N/A", 35, deliveryY + 51);

  if (order.deliveryNote || order.shippingAddress?.note) {
    doc.text(`Note: ${order.deliveryNote || order.shippingAddress?.note}`, 35, deliveryY + 64);
  }

  // ===== PRODUCTS TABLE =====
  const tableStartY = (order.deliveryNote || order.shippingAddress?.note) ? deliveryY + 80 : deliveryY + 70;
  let y = tableStartY;

  // Column widths matching React PDF (12%, 32%, 10%, 18%, 18%, 10%)
  const colWidths = {
    reference: 64, // 12% of 535
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

  // Table rows with dynamic data
const products = order.products || order.items || [];

if (products.length === 0) {
  // Add a default product row to show something
  products.push({
    reference: "N/A",
    name: "No products in order",
    qty: 0,
    unitPrice: "0.00 €",
    totalExclVat: "0.00 €", 
    vatRate: 0
  });
}  
  if (products.length === 0) {
    // Add empty row if no products
    doc.moveTo(30, y).lineTo(565, y).stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .text("No products", colPositions.product + 4, y + 4, { width: colWidths.product - 8 });
    y += 15;
  } else {
    products.forEach((product, index) => {
      // Draw horizontal line
      doc.moveTo(30, y).lineTo(565, y).stroke();
      
      doc
        .font("Helvetica")
        .fontSize(8)
        .text(product.reference || product.sku || "-", colPositions.reference + 4, y + 4, { width: colWidths.reference - 8 })
        .text(product.name || product.title || "-", colPositions.product + 4, y + 4, { width: colWidths.product - 8 })
        .text(String(product.quantity || product.qty || 0), colPositions.qty + 4, y + 4, { width: colWidths.qty - 8 })
        .text(formatCurrency(product.unitPrice || product.price || 0), colPositions.price + 4, y + 4, { width: colWidths.price - 8 })
        .text(formatCurrency(product.totalExclVat || (product.quantity * product.price) || 0), colPositions.total + 4, y + 4, { width: colWidths.total - 8 })
        .text(`${product.vatRate || product.taxRate || 20}%`, colPositions.vat + 4, y + 4, { width: colWidths.vat - 8 });

      y += 15;
    });
  }

  // Final table bottom line
  doc.moveTo(30, y).lineTo(565, y).stroke();

  // ===== TOTALS SECTION - Clean layout like Image 1 =====
  const totalsY = y + 20;

  // Calculate totals dynamically
  const totalExclVat = products.reduce((sum, product) => sum + (product.totalExclVat || (product.quantity * product.price) || 0), 0);
  const totalVat = products.reduce((sum, product) => {
    const productTotal = product.totalExclVat || (product.quantity * product.price) || 0;
    const vatRate = product.vatRate || product.taxRate || 20;
    return sum + (productTotal * vatRate / 100);
  }, 0);
  const grandTotal = totalExclVat + totalVat;

  // Payment Type Section (Left - 48% width)
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

  const paymentData = order.paymentData || [
    { 
      paymentType: order.paymentMethod || "Credit Card", 
      amount: formatCurrency(grandTotal) 
    }
  ];

  paymentData.forEach((payment, index) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(payment.paymentType, paymentSectionX + 10, paymentY + 6)
      .text(payment.amount, paymentSectionX + paymentSectionWidth - 40, paymentY + 6, { align: "right" });

    paymentY += 18;
  });

  // VAT Breakdown (only if multiple VAT rates)
  const vatRates = {};
  products.forEach(product => {
    const rate = product.vatRate || product.taxRate || 20;
    const productTotal = product.totalExclVat || (product.quantity * product.price) || 0;
    if (!vatRates[rate]) {
      vatRates[rate] = { base: 0, total: 0 };
    }
    vatRates[rate].base += productTotal;
    vatRates[rate].total += productTotal * rate / 100;
  });

  const vatStartY = paymentY + 10;
  let vatY = vatStartY;

  Object.entries(vatRates).forEach(([rate, amounts], index) => {
    if (Object.keys(vatRates).length > 1) { // Only show breakdown if multiple rates
      doc
        .font("Helvetica")
        .fontSize(8)
        .text("VAT", paymentSectionX + 10, vatY)
        .text(`${parseFloat(rate).toFixed(2)}%`, paymentSectionX + paymentSectionWidth - 40, vatY, { align: "right" })
        .text("Base", paymentSectionX + 10, vatY + 10)
        .text(formatCurrency(amounts.base), paymentSectionX + paymentSectionWidth - 40, vatY + 10, { align: "right" })
        .text("Total", paymentSectionX + 10, vatY + 20)
        .text(formatCurrency(amounts.total), paymentSectionX + paymentSectionWidth - 40, vatY + 20, { align: "right" });

      vatY += 35;
    }
  });

  // Summary Table (Right - 48% width)
  const summarySectionX = 307;
  const summarySectionWidth = 258;

  // TOTAL row with background
  doc
    .rect(summarySectionX, totalsY, summarySectionWidth, 18)
    .fill("#f0f0f0")
    .stroke()
    .fillColor(black)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("TOTAL", summarySectionX + 10, totalsY + 6)
    .text(formatCurrency(grandTotal), summarySectionX + summarySectionWidth - 40, totalsY + 6, { align: "right" });

  let summaryY = totalsY + 18;

  const summaryRows = [
    { label: "Total VAT EXCL", value: formatCurrency(totalExclVat), bold: false },
    { label: "VAT", value: formatCurrency(totalVat), bold: false },
    { label: "Total VAT INCL", value: formatCurrency(grandTotal), bold: true }
  ];

  summaryRows.forEach((row, index) => {
    // Draw separator line
    doc.moveTo(summarySectionX, summaryY).lineTo(summarySectionX + summarySectionWidth, summaryY).stroke();
    
    const font = row.bold ? "Helvetica-Bold" : "Helvetica";
    doc
      .font(font)
      .fontSize(9)
      .text(row.label, summarySectionX + 10, summaryY + 6)
      .text(row.value, summarySectionX + summarySectionWidth - 40, summaryY + 6, { align: "right" });

    summaryY += 18;
  });

  // ===== BANK DETAILS =====
  const bankY = Math.max(vatY, summaryY) + 20;
  doc
    .rect(30, bankY, 535, 30)
    .stroke()
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("Bank Details", 35, bankY + 5)
    .font("Helvetica")
    .text("BNP PARIBAS", 35, bankY + 15)
    .text(`IBAN: ${order.bankDetails?.iban || "FR76 3000 4000 0100 1234 5678 900"}`, 35, bankY + 25)
    .text(`BIC: ${order.bankDetails?.bic || "BNPAFRPP"}`, 35, bankY + 35);

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

// Helper function to format currency
function formatCurrency(amount) {
  if (typeof amount === 'string') return amount;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(amount);
}