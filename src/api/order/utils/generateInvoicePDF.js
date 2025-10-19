// @ts-nocheck
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

module.exports = async function generateInvoicePDF(order) {
  const filePath = path.join(__dirname, `../../tmp/invoice-${order.id}.pdf`);
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(20).text("INVOICE", { align: "center" });
  doc.moveDown();
  doc.text(`Order ID: ${order.id}`);
  doc.text(`Customer: ${order.user?.username || "Unknown"}`);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
  doc.moveDown();

  doc.fontSize(14).text("Items:");
  order.items.forEach((item, i) => {
    doc.text(`${i + 1}. ${item.name} — ${item.price} x ${item.quantity}`);
  });

  doc.moveDown();
  doc.fontSize(16).text(`Total: ${order.total}`, { align: "right" });

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return filePath;
};
