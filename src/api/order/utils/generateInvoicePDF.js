// @ts-nocheck
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

module.exports = async function generateInvoicePDF(order) {
  // Ensure tmp directory exists
  const tmpDir = path.join(__dirname, "../../tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const filePath = path.join(tmpDir, `invoice-${order.id}.pdf`);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const green = "#4e5f4b";
  const black = "#000000";

  // ===== HEADER SECTION =====
  doc
    .fontSize(18)
    .fillColor(black)
    .text("INVOICE", { align: "right" });

  doc
    .fontSize(10)
    .text(`Invoice No: ${order.invoiceNumber || order.id}`, { align: "right" })
    .text(
      `Date: ${order.invoiceDate || new Date(order.createdAt).toLocaleDateString()}`,
      { align: "right" }
    );

  doc.moveDown();

  // Company Info (left)
  doc
    .fontSize(10)
    .fillColor(black)
    .text("BENEKI", 40, 60)
    .text("691 rue Maurice Caullery")
    .text("59500 Douai, FRANCE")
    .text("www.beneki.net")
    .text("Tel. 03 74 09 81 86");

  // Customer Info (right box)
  doc.rect(350, 60, 200, 80).stroke();
  doc
    .fontSize(9)
    .text("Customer:", 355, 65)
    .text(order.customerCompany || order.user?.username || "N/A", 355, 80)
    .text(order.customerAddress || "", 355, 95)
    .text(order.customerCity || "", 355, 110)
    .text(order.customerCountry || "", 355, 125);

  // ===== DELIVERY ADDRESS =====
  doc
    .moveDown(4)
    .fontSize(11)
    .fillColor("white")
    .rect(40, 160, 515, 18)
    .fill(green)
    .stroke()
    .fillColor("white")
    .text("Delivery address:", 45, 163)
    .fillColor(black);

  doc
    .fontSize(9)
    .text(order.deliveryName || "N/A", 45, 185)
    .text(order.deliveryAddress || "N/A", 45, 198)
    .text(order.deliveryPhone || "N/A", 45, 211);

  if (order.deliveryNote) doc.text(`Note: ${order.deliveryNote}`, 45, 224);

  // ===== PRODUCTS TABLE =====
  const startY = 250;
  let y = startY;

  const drawTableRow = (row, bold = false) => {
    const font = bold ? "Helvetica-Bold" : "Helvetica";
    doc.font(font).fontSize(8).fillColor(black);

    const colX = [45, 110, 270, 320, 400, 470];
    const colW = [65, 160, 50, 80, 70, 60];

    colX.forEach((x, i) => {
      doc.text(row[i], x, y, { width: colW[i], continued: false });
    });
    y += 15;
    doc.moveTo(40, y - 2).lineTo(555, y - 2).strokeColor("#ccc").stroke();
  };

  // Table Header
  doc
    .rect(40, y, 515, 15)
    .fill(green)
    .stroke()
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(8);
  doc.text("Reference", 45, y + 3);
  doc.text("Product", 110, y + 3);
  doc.text("Qty", 270, y + 3);
  doc.text("Price Excl. VAT", 320, y + 3);
  doc.text("Total Excl. VAT", 400, y + 3);
  doc.text("VAT %", 470, y + 3);
  y += 15;
  doc.fillColor(black);

  const products = order.items?.length
    ? order.items
    : [
        {
          reference: "B3002ITCAR",
          name: "Product name + variation",
          quantity: 3,
          unitPrice: "24.90 €",
          totalExclVat: "74.70 €",
          vatRate: 20,
        },
        {
          reference: "B3002ITV",
          name: "Product name",
          quantity: 1,
          unitPrice: "48.76 €",
          totalExclVat: "48.76 €",
          vatRate: 5.5,
        },
      ];

  for (const p of products) {
    drawTableRow([
      p.reference || "-",
      p.name || "-",
      String(p.quantity),
      p.unitPrice || "-",
      p.totalExclVat || "-",
      `${p.vatRate}%`,
    ]);
  }

  // ===== SUMMARY SECTION =====
  y += 20;
  doc.font("Helvetica-Bold").fontSize(10).text("TOTAL SUMMARY", 45, y);
  y += 10;
  doc.font("Helvetica").fontSize(9);

  const summaryRows = [
    ["Total VAT EXCL", order.totalExclVat || "123.46 €"],
    ["VAT", order.totalVat || "17.62 €"],
    ["Total VAT INCL", order.grandTotal || "141.08 €"],
  ];

  summaryRows.forEach(([label, value]) => {
    doc.text(label, 350, y, { width: 150 });
    doc.text(value, 500, y, { align: "right" });
    y += 14;
  });

  // ===== BANK DETAILS =====
  y += 20;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Bank Details", 45, y)
    .font("Helvetica")
    .fontSize(8);
  y += 12;
  doc.text("BNP PARIBAS", 45, y);
  doc.text(
    `IBAN: ${order.bankDetails?.iban || "FR76 3000 4000 0100 1234 5678 900"}`,
    45,
    y + 12
  );
  doc.text(`BIC: ${order.bankDetails?.bic || "BNPAFRPP"}`, 45, y + 24);

  // ===== FOOTER =====
  doc
    .fontSize(7)
    .fillColor("#555")
    .text(
      "BENEKI conserve la propriété pleine et entière des marchandises jusqu'au complet paiement du prix suivant la loi 80.335 du 12 mai 1980. Pas d'escompte pour paiement anticipé. En cas de paiement hors délai, une pénalité égale à trois fois le taux de l'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de 40 €uros pour frais de recouvrement L-411-6 du Code de Commerce. Les conditions générales de ventes applicables sont disponibles sur www.beneki.net",
      45,
      720,
      { width: 500, align: "justify" }
    );

  doc
    .moveDown(0.5)
    .fontSize(7)
    .fillColor("#333")
    .text(
      "BENEKI SARL / Capital 150 000€ / VAT Number : FR61889408019 / Siret 88940801900020 / APE 4690Z",
      { align: "center" }
    );

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return filePath;
};
