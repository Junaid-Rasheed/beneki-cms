// src/services/pdfService.js
"use strict";

// @ts-ignore
const { pdf, Document, Page, Text, View, Image, StyleSheet } = require('@react-pdf/renderer');
const React = require('react');
// @ts-ignore
const path = require('path');

// Reuse the exact same styles from your frontend component
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  leftSection: {
    width: "60%",
  },
  rightSection: {
    width: "35%",
  },
  companyAddress: {
    fontSize: 11,
    lineHeight: 1.2,
    marginBottom: 5,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "left",
  },
  invoiceInfo: {
    fontSize: 9,
    lineHeight: 1.3,
    marginBottom: 10,
  },
  customerInfo: {
    fontSize: 9,
    lineHeight: 1.3,
    paddingBottom: 5,
    paddingTop: 5,
  },
  section: {
    marginBottom: 8,
    border: "1px solid #000",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
    backgroundColor: "#4e5f4b",
    color: "white",
    padding: 3,
  },
  addressBox: {
    padding: 2,
  },
  table: {
    width: "100%",
    marginTop: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
    minHeight: 20,
  },
  tableHeader: {
    backgroundColor: "#4e5f4b",
    color: "white",
    fontWeight: "bold",
    padding: 4,
    fontSize: 8,
  },
  tableCell: {
    padding: 4,
    fontSize: 8,
  },
  colReference: { width: "12%" },
  colProduct: { width: "32%" },
  colQty: { width: "10%" },
  colPrice: { width: "18%" },
  colTotal: { width: "18%" },
  colVatPercent: { width: "10%" },
  totalsSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  paymentSection: {
    width: "48%",
    border: "1px solid #000",
  },
  paymentTitle: {
    fontSize: 10,
    fontWeight: "bold",
    backgroundColor: "#4e5f4b",
    color: "white",
    padding: 4,
    textAlign: "center",
  },
  paymentTypeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 6,
    borderBottom: "1px solid #000",
  },
  paymentTypeLabel: {
    fontWeight: "bold",
    fontSize: 9,
  },
  paymentTypeAmount: {
    fontSize: 9,
    fontWeight: "bold",
  },
  vatBreakdown: {
    padding: 6,
  },
  vatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 8,
  },
  summaryTable: {
    width: "48%",
    border: "1px solid #000",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 6,
    borderBottom: "1px solid #000",
    fontSize: 9,
  },
  summaryRowBold: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 6,
    borderBottom: "1px solid #000",
    fontSize: 9,
    fontWeight: "bold",
  },
  bankDetails: {
    marginTop: 12,
    padding: 5,
    border: "1px solid #000",
    fontSize: 8,
  },
  bankTitle: {
    fontWeight: "bold",
    marginBottom: 2,
  },
  footer: {
    marginTop: 15,
    fontSize: 7,
    textAlign: "justify",
    lineHeight: 1.2,
  },
  legalFooter: {
    marginTop: 10,
    fontSize: 7,
    textAlign: "center",
    borderTop: "1px solid #000",
    paddingTop: 5,
  },
  bold: {
    fontWeight: "bold",
  },
  pageInfo: {
    position: "absolute",
    top: 30,
    right: 30,
    fontSize: 8,
    color: "#666",
  },
});

// Simple InvoicePDF component
const InvoicePDF = ({ order }) => {
  const products = order.products || [];
  const paymentData = order.paymentData || [];
  // @ts-ignore
  const vatBreakdown = order.vatBreakdown || [];

  return React.createElement(Document, {},
    React.createElement(Page, { size: "A4", style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(View, { style: styles.leftSection },
          React.createElement(View, { style: styles.companyAddress },
            React.createElement(Text, {}, "691 rue Maurice Caullery"),
            React.createElement(Text, {}, "59500 Douai"),
            React.createElement(Text, {}, "FRANCE"),
            React.createElement(Text, {}, "www.beneki.net"),
            React.createElement(Text, {}, "Tel. 03 74 09 81 86")
          )
        ),
        React.createElement(View, { style: styles.rightSection },
          React.createElement(Text, { style: styles.invoiceTitle }, "INVOICE"),
          React.createElement(View, { style: styles.invoiceInfo },
            React.createElement(Text, {}, `N° ${order.invoiceNumber}`),
            React.createElement(Text, {}, `Date : ${order.invoiceDate}`)
          ),
          React.createElement(View, { style: styles.customerInfo },
            React.createElement(Text, { style: styles.bold }, "Customer Company Name"),
            React.createElement(Text, {}, order.customerCompany),
            React.createElement(Text, {}, order.customerAddress),
            React.createElement(Text, {}, order.customerCity),
            React.createElement(Text, {}, order.customerCountry)
          ),
          React.createElement(View, { style: styles.invoiceInfo },
            React.createElement(Text, {}, `Client ref : ${order.clientRef}`),
            React.createElement(Text, {}, `Email : ${order.clientEmail}`),
            React.createElement(Text, {}, `TVA Intracom : ${order.customerVAT || "N/A"}`)
          )
        )
      ),

      // Delivery Address
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Delivery address :"),
        React.createElement(View, { style: styles.addressBox },
          React.createElement(Text, {}, order.deliveryName),
          React.createElement(Text, {}, order.deliveryAddress),
          React.createElement(Text, {}, order.deliveryPhone),
          order.deliveryNote && React.createElement(Text, {}, `Note: ${order.deliveryNote}`)
        )
      ),

      // Products Table
      React.createElement(View, { style: styles.section },
        React.createElement(View, { style: styles.table },
          // Table Header
          React.createElement(View, { style: styles.tableRow },
            React.createElement(Text, { style: [styles.tableHeader, styles.colReference] }, "Reference"),
            React.createElement(Text, { style: [styles.tableHeader, styles.colProduct] }, "Product"),
            React.createElement(Text, { style: [styles.tableHeader, styles.colQty] }, "Qty"),
            React.createElement(Text, { style: [styles.tableHeader, styles.colPrice] }, "Price VAT Excluded"),
            React.createElement(Text, { style: [styles.tableHeader, styles.colTotal] }, "Total VAT Excluded"),
            React.createElement(Text, { style: [styles.tableHeader, styles.colVatPercent] }, "VAT %")
          ),

          // Table Rows
          products.map((product, index) =>
            React.createElement(View, { key: index, style: styles.tableRow },
              React.createElement(Text, { style: [styles.tableCell, styles.colReference] }, product.reference),
              React.createElement(Text, { style: [styles.tableCell, styles.colProduct] }, product.name),
              React.createElement(Text, { style: [styles.tableCell, styles.colQty] }, product.qty),
              React.createElement(Text, { style: [styles.tableCell, styles.colPrice] }, product.unitPrice),
              React.createElement(Text, { style: [styles.tableCell, styles.colTotal] }, product.totalExclVat),
              React.createElement(Text, { style: [styles.tableCell, styles.colVatPercent] }, `${product.vatRate}%`)
            )
          )
        )
      ),

      // Totals Section
      React.createElement(View, { style: styles.totalsSection },
        React.createElement(View, { style: styles.paymentSection },
          React.createElement(Text, { style: styles.paymentTitle }, "Payment Type"),
          paymentData.map((payment, index) =>
            React.createElement(View, { key: index, style: styles.paymentTypeRow },
              React.createElement(Text, { style: styles.paymentTypeLabel }, payment.paymentType),
              React.createElement(Text, { style: styles.paymentTypeAmount }, payment.amount)
            )
          )
        ),
        React.createElement(View, { style: styles.summaryTable },
          React.createElement(View, { style: [styles.summaryRowBold, { backgroundColor: "#f0f0f0" }] },
            React.createElement(Text, {}, "TOTAL"),
            React.createElement(Text, {}, order.grandTotal || "141.08 €")
          ),
          React.createElement(View, { style: styles.summaryRow },
            React.createElement(Text, {}, "Total VAT EXCL"),
            React.createElement(Text, {}, order.totalExclVat || "123.46 €")
          ),
          React.createElement(View, { style: styles.summaryRow },
            React.createElement(Text, {}, "VAT"),
            React.createElement(Text, {}, order.totalVat || "17.62 €")
          ),
          React.createElement(View, { style: [styles.summaryRowBold, { borderBottom: "none" }] },
            React.createElement(Text, {}, "Total VAT INCL"),
            React.createElement(Text, {}, order.grandTotal || "141.08 €")
          )
        )
      ),

      // Bank Details
      React.createElement(View, { style: styles.bankDetails },
        React.createElement(Text, { style: styles.bankTitle }, "Bank Details"),
        React.createElement(Text, { style: styles.bold }, "BNP PARIBAS"),
        React.createElement(Text, {}, `IBAN: ${order.bankDetails?.iban || "FR76 3000 4000 0100 1234 5678 900"}`),
        React.createElement(Text, {}, `BIC: ${order.bankDetails?.bic || "BNPAFRPP"}`)
      ),

      // Footer
      React.createElement(View, { style: styles.footer },
        React.createElement(Text, {},
          "BENEKI conserve la propriété pleine et entière des marchandises jusqu'au complet paiement du prix suivant la loi 80.335 du 12 mai 1980. Pas d'escompte pour paiement anticipé. En cas de paiement hors délai, une pénalité égale à trois fois le taux de l'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de 40 €uros pour frais de recouvrement L-411-6 du Code de Commerce. Les conditions générales de ventes applicables sont disponibles sur notre site www.beneki.net"
        )
      ),

      // Legal Footer
      React.createElement(View, { style: styles.legalFooter },
        React.createElement(Text, {},
          "BENEKI SARL / Capital 150 000€ / VAT Number : FR61889408019 / Siret 88940801900020 / APE 4690Z"
        )
      )
    )
  );
};

// SIMPLE WORKING VERSION - Use this if above doesn't work
class PDFService {
  static async generateInvoicePDF(orderData) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Generating PDF for order:', orderData.invoiceNumber);
        
        const invoiceDocument = InvoicePDF({ order: orderData });
        const stream = pdf(invoiceDocument);
        
        const chunks = [];
        
        // @ts-ignore
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        // @ts-ignore
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        // @ts-ignore
        stream.on('error', reject);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  static async generateAndSaveInvoice(orderData, filePath) {
    const fs = require('fs').promises;
    const pdfBuffer = await this.generateInvoicePDF(orderData);
    await fs.writeFile(filePath, pdfBuffer);
    return filePath;
  }
}

module.exports = { PDFService };