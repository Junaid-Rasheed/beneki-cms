// src/services/pdfService.js - FIXED

// @ts-nocheck
"use strict";

const { pdf, Document, Page, Text, View, Image, StyleSheet } = require('@react-pdf/renderer');
const React = require('react');

const styles = StyleSheet.create({
  // ... keep your existing styles (they look good)
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

// FIXED: Simple InvoicePDF component with proper Text wrapping
const InvoicePDF = ({ order }) => {
  const products = order.products || [];
  const paymentData = order.paymentData || [];
  const vatBreakdown = order.vatBreakdown || [];

  return React.createElement(Document, {}, 
    React.createElement(Page, { size: "A4", style: styles.page }, [
      // Page number
      React.createElement(Text, { key: "pageInfo", style: styles.pageInfo }, "Page 1/1"),

      // Header Section
      React.createElement(View, { key: "header", style: styles.header }, [
        // Left Section
        React.createElement(View, { key: "leftSection", style: styles.leftSection }, [
          React.createElement(View, { key: "companyAddress", style: styles.companyAddress }, [
            React.createElement(Text, { key: "addr1" }, "691 rue Maurice Caullery"),
            React.createElement(Text, { key: "addr2" }, "59500 Douai"),
            React.createElement(Text, { key: "addr3" }, "FRANCE"),
            React.createElement(Text, { key: "website" }, "www.beneki.net"),
            React.createElement(Text, { key: "phone" }, "Tel. 03 74 09 81 86")
          ])
        ]),

        // Right Section
        React.createElement(View, { key: "rightSection", style: styles.rightSection }, [
          React.createElement(Text, { key: "invoiceTitle", style: styles.invoiceTitle }, "INVOICE"),
          React.createElement(View, { key: "invoiceInfo1", style: styles.invoiceInfo }, [
            React.createElement(Text, { key: "invNum" }, `N° ${order.invoiceNumber}`),
            React.createElement(Text, { key: "invDate" }, `Date : ${order.invoiceDate}`)
          ]),
          React.createElement(View, { key: "customerInfo", style: styles.customerInfo }, [
            React.createElement(Text, { key: "custLabel", style: styles.bold }, "Customer Company Name"),
            React.createElement(Text, { key: "custCompany" }, order.customerCompany || "N/A"),
            React.createElement(Text, { key: "custAddr" }, order.customerAddress || "N/A"),
            React.createElement(Text, { key: "custCity" }, order.customerCity || "N/A"),
            React.createElement(Text, { key: "custCountry" }, order.customerCountry || "N/A")
          ]),
          React.createElement(View, { key: "invoiceInfo2", style: styles.invoiceInfo }, [
            React.createElement(Text, { key: "clientRef" }, `Client ref : ${order.clientRef || "N/A"}`),
            React.createElement(Text, { key: "clientEmail" }, `Email : ${order.clientEmail || "N/A"}`),
            React.createElement(Text, { key: "clientVAT" }, `TVA Intracom : ${order.customerVAT || "N/A"}`)
          ])
        ])
      ]),

      // Delivery Address Section
      React.createElement(View, { key: "deliverySection", style: styles.section }, [
        React.createElement(Text, { key: "deliveryTitle", style: styles.sectionTitle }, "Delivery address :"),
        React.createElement(View, { key: "addressBox", style: styles.addressBox }, [
          React.createElement(Text, { key: "delName" }, order.deliveryName || "N/A"),
          React.createElement(Text, { key: "delAddr" }, order.deliveryAddress || "N/A"),
          React.createElement(Text, { key: "delPhone" }, order.deliveryPhone || "N/A"),
          order.deliveryNote ? React.createElement(Text, { key: "delNote" }, `Note: ${order.deliveryNote}`) : null
        ])
      ]),

      // Products Table
      React.createElement(View, { key: "productsSection", style: styles.section }, [
        React.createElement(View, { key: "table", style: styles.table }, [
          // Table Header
          React.createElement(View, { key: "tableHeader", style: styles.tableRow }, [
            React.createElement(Text, { key: "refHeader", style: [styles.tableHeader, styles.colReference] }, "Reference"),
            React.createElement(Text, { key: "prodHeader", style: [styles.tableHeader, styles.colProduct] }, "Product"),
            React.createElement(Text, { key: "qtyHeader", style: [styles.tableHeader, styles.colQty] }, "Qty"),
            React.createElement(Text, { key: "priceHeader", style: [styles.tableHeader, styles.colPrice] }, "Price VAT Excluded"),
            React.createElement(Text, { key: "totalHeader", style: [styles.tableHeader, styles.colTotal] }, "Total VAT Excluded"),
            React.createElement(Text, { key: "vatHeader", style: [styles.tableHeader, styles.colVatPercent] }, "VAT %")
          ]),

          // Table Rows - FIXED: Check for empty products array
          products.length > 0 ? products.map((product, index) =>
            React.createElement(View, { key: `product-${index}`, style: styles.tableRow }, [
              React.createElement(Text, { key: "ref", style: [styles.tableCell, styles.colReference] }, product.reference || "N/A"),
              React.createElement(Text, { key: "name", style: [styles.tableCell, styles.colProduct] }, product.name || "N/A"),
              React.createElement(Text, { key: "qty", style: [styles.tableCell, styles.colQty] }, product.qty || "0"),
              React.createElement(Text, { key: "price", style: [styles.tableCell, styles.colPrice] }, product.unitPrice || "0.00 €"),
              React.createElement(Text, { key: "total", style: [styles.tableCell, styles.colTotal] }, product.totalExclVat || "0.00 €"),
              React.createElement(Text, { key: "vat", style: [styles.tableCell, styles.colVatPercent] }, `${product.vatRate || 0}%`)
            ])
          ) : React.createElement(View, { key: "no-products", style: styles.tableRow }, [
            React.createElement(Text, { key: "empty", style: [styles.tableCell, styles.colProduct] }, "No products")
          ])
        ])
      ]),

      // Totals Section
      React.createElement(View, { key: "totalsSection", style: styles.totalsSection }, [
        // Payment Type Section
        React.createElement(View, { key: "paymentSection", style: styles.paymentSection }, [
          React.createElement(Text, { key: "paymentTitle", style: styles.paymentTitle }, "Payment Type"),
          // FIXED: Check for empty payment data
          paymentData.length > 0 ? paymentData.map((payment, index) =>
            React.createElement(View, { key: `payment-${index}`, style: styles.paymentTypeRow }, [
              React.createElement(Text, { key: "type", style: styles.paymentTypeLabel }, payment.paymentType || "N/A"),
              React.createElement(Text, { key: "amount", style: styles.paymentTypeAmount }, payment.amount || "0.00 €")
            ])
          ) : React.createElement(View, { key: "no-payment", style: styles.paymentTypeRow }, [
            React.createElement(Text, { key: "type", style: styles.paymentTypeLabel }, "No payment data"),
            React.createElement(Text, { key: "amount", style: styles.paymentTypeAmount }, "0.00 €")
          ]),
          
          // VAT Breakdown - FIXED: Only render if has data
          vatBreakdown.length > 0 ? React.createElement(View, { key: "vatBreakdown", style: styles.vatBreakdown },
            vatBreakdown.map((vat, index) =>
              React.createElement(View, { key: `vat-${index}` }, [
                React.createElement(View, { key: "rate", style: styles.vatRow }, [
                  React.createElement(Text, { key: "label1" }, "VAT"),
                  React.createElement(Text, { key: "value1" }, vat.rate || "0%")
                ]),
                React.createElement(View, { key: "base", style: styles.vatRow }, [
                  React.createElement(Text, { key: "label2" }, "Base"),
                  React.createElement(Text, { key: "value2" }, vat.base || "0.00 €")
                ]),
                React.createElement(View, { key: "total", style: styles.vatRow }, [
                  React.createElement(Text, { key: "label3" }, "Total"),
                  React.createElement(Text, { key: "value3" }, vat.total || "0.00 €")
                ])
              ])
            )
          ) : null
        ]),

        // Summary Table
        React.createElement(View, { key: "summaryTable", style: styles.summaryTable }, [
          React.createElement(View, { key: "totalRow", style: [styles.summaryRowBold, { backgroundColor: "#f0f0f0" }] }, [
            React.createElement(Text, { key: "label1" }, "TOTAL"),
            React.createElement(Text, { key: "value1" }, order.grandTotal || "0.00 €")
          ]),
          React.createElement(View, { key: "exclRow", style: styles.summaryRow }, [
            React.createElement(Text, { key: "label2" }, "Total VAT EXCL"),
            React.createElement(Text, { key: "value2" }, order.totalExclVat || "0.00 €")
          ]),
          React.createElement(View, { key: "vatRow", style: styles.summaryRow }, [
            React.createElement(Text, { key: "label3" }, "VAT"),
            React.createElement(Text, { key: "value3" }, order.totalVat || "0.00 €")
          ]),
          React.createElement(View, { key: "inclRow", style: [styles.summaryRowBold, { borderBottom: "none" }] }, [
            React.createElement(Text, { key: "label4" }, "Total VAT INCL"),
            React.createElement(Text, { key: "value4" }, order.grandTotal || "0.00 €")
          ])
        ])
      ]),

      // Bank Details
      React.createElement(View, { key: "bankDetails", style: styles.bankDetails }, [
        React.createElement(Text, { key: "bankTitle", style: styles.bankTitle }, "Bank Details"),
        React.createElement(Text, { key: "bankName", style: styles.bold }, "BNP PARIBAS"),
        React.createElement(Text, { key: "iban" }, `IBAN: ${order.bankDetails?.iban || "FR76 3000 4000 0100 1234 5678 900"}`),
        React.createElement(Text, { key: "bic" }, `BIC: ${order.bankDetails?.bic || "BNPAFRPP"}`)
      ]),

      // Footer Text
      React.createElement(View, { key: "footer", style: styles.footer }, [
        React.createElement(Text, { key: "footerText" },
          "BENEKI conserve la propriété pleine et entière des marchandises jusqu'au complet paiement du prix suivant la loi 80.335 du 12 mai 1980. Pas d'escompte pour paiement anticipé. En cas de paiement hors délai, une pénalité égale à trois fois le taux de l'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de 40 €uros pour frais de recouvrement L-411-6 du Code de Commerce. Les conditions générales de ventes applicables sont disponibles sur notre site www.beneki.net"
        )
      ]),

      // Legal Footer
      React.createElement(View, { key: "legalFooter", style: styles.legalFooter }, [
        React.createElement(Text, { key: "legalText" },
          "BENEKI SARL / Capital 150 000€ / VAT Number : FR61889408019 / Siret 88940801900020 / APE 4690Z"
        )
      ])
    ])
  );
};

class PDFService {
  static async generateInvoicePDF(orderData) {
    return new Promise((resolve, reject) => {
      try {
        console.log('📄 Generating PDF for order:', orderData.invoiceNumber);
        
        const invoiceDocument = InvoicePDF({ order: orderData });
        const stream = pdf(invoiceDocument);
        
        const chunks = [];
        
        stream.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        
        stream.on('end', () => {
          try {
            const pdfBuffer = Buffer.concat(chunks);
            console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');
            resolve(pdfBuffer);
          } catch (error) {
            console.error('❌ Error creating buffer from chunks:', error);
            reject(error);
          }
        });
        
        stream.on('error', (error) => {
          console.error('❌ PDF stream error:', error);
          reject(error);
        });
        
      } catch (error) {
        console.error('❌ PDF generation setup error:', error);
        reject(error);
      }
    });
  }

  static async generateAndSaveInvoice(orderData, filePath) {
    try {
      const fs = require('fs').promises;
      console.log('💾 Saving PDF to:', filePath);
      const pdfBuffer = await this.generateInvoicePDF(orderData);
      await fs.writeFile(filePath, pdfBuffer);
      console.log('✅ PDF saved successfully');
      return filePath;
    } catch (error) {
      console.error('❌ Error saving PDF:', error);
      throw error;
    }
  }
}

module.exports = { PDFService };