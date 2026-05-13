"use strict";

const soap = require("soap");
const AdmZip = require("adm-zip");
const { PassThrough } = require("stream");
const { PDFDocument } = require("pdf-lib");

const path = require("path");

const WSDL_PATH = path.join(
  __dirname,
  "../../../wsdl/dpd.wsdl"
);

module.exports = {
  async generateShipment(data) {
    console.log("before creating client");
    const client = await soap.createClientAsync(
    WSDL_PATH,
    {
        disableCache: true,
    }
    );
    console.log("after creating client");
    
    console.log("SOAP description saved");
    //console.log(client.describe());
    // SOAP HEADER AUTH
    // const soapHeader = {
    //   UserCredentials: {
    //     userid: process.env.DPD_USER,
    //     password: process.env.DPD_PASSWORD,
    //   },
    // };

    const soapHeader = {
        'UserCredentials': {
            'userid': process.env.DPD_USER,
            'password': process.env.DPD_PASSWORD,
            'attributes': {
                'xmlns': 'http://www.cargonet.software'
            }
        }
    };
    client.addSoapHeader(soapHeader);

    /*
      Expected payload from frontend:

      {
        receiver: {...},
        shipper: {...},
        parcels: [
          {
            weight: "2.5",
            reference: "BOX-1"
          },
          {
            weight: "1.2",
            reference: "BOX-2"
          }
        ]
      }
    */
    //console.log("data", data)
    console.log("data",JSON.stringify(data, null, 2))
    const request = {
      customer_countrycode: Number(
        process.env.DPD_COUNTRY_CODE
      ),

      customer_centernumber: Number(
        process.env.DPD_CENTER_NUMBER
      ),

      customer_number: Number(
        process.env.DPD_CUSTOMER_NUMBER
      ),

      shipperaddress: {
        name: data.shipper.name,
        countryPrefix: data.shipper.countryPrefix,
        zipCode: data.shipper.zipCode,
        city: data.shipper.city,
        street: data.shipper.street,
        phoneNumber: data.shipper.phoneNumber,
      },
      
      receiveraddress: {
        name: data.receivercompanyName || data.receiver.name,
        countryPrefix: data.receiver.countryPrefix,
        zipCode: data.receiver.zipCode,
        city: data.receiver.city,
        street: data.receiver.street,
        phoneNumber: data.receiver.phoneNumber,
      },
      receiverinfo: {
        contact: data.receiver.name || "",
        name2: data.receiver.name2 || "",
        name3: data.receiver.name3 || "",
        name4: data.receiver.name4 || "",
        digicode1: data.receiver.digicode1 || "",
        digicode2: data.receiver.digicode2 || "",
        intercomid: data.receiver.intercomid || "",
        vinfo1: data.receiver.deliveryInstruction || "",
        vinfo2: data.receiver.vinfo2 || "",
    },
      shippingdate: new Date()
        .toLocaleDateString("fr-FR")
        .replace(/\//g, "."),

      services: {
        consolidation: {
          type: "CombinedDelivery",
        },
      },

      slaves: data.slaves
    };

//     const request = {
//   customer_countrycode: Number(
//     process.env.DPD_COUNTRY_CODE
//   ),

//   customer_centernumber: Number(
//     process.env.DPD_CENTER_NUMBER
//   ),

//   customer_number: Number(
//     process.env.DPD_CUSTOMER_NUMBER
//   ),

//   shipperaddress: {
//     name: data.shipper.name,
//     countryPrefix: data.shipper.countryPrefix,
//     zipCode: data.shipper.zipCode,
//     city: data.shipper.city,
//     street: data.shipper.street,
//     phoneNumber: data.shipper.phoneNumber,
//   },

//   // ADD THIS - shipperinfo object
//   shipperinfo: {
//     contact: data.shipper.contact || "",
//     name2: data.shipper.name2 || "",
//     name3: data.shipper.name3 || "",
//     name4: data.shipper.name4 || "",
//     digicode1: data.shipper.digicode1 || "",
//     digicode2: data.shipper.digicode2 || "",
//     intercomid: data.shipper.intercomid || "",
//     vinfo1: data.shipper.vinfo1 || "",
//     vinfo2: data.shipper.vinfo2 || "",
//   },

//   receiveraddress: {
//     name: data.receiver.name,
//     countryPrefix: data.receiver.countryPrefix,
//     zipCode: data.receiver.zipCode,
//     city: data.receiver.city,
//     street: data.receiver.street,
//     phoneNumber: data.receiver.phoneNumber,
//   },

//   // ADD THIS - receiverinfo object
//   receiverinfo: {
//     contact: data.receiver.contact || "",
//     name2: data.receiver.name2 || "",
//     name3: data.receiver.name3 || "",
//     name4: data.receiver.name4 || "",
//     digicode1: data.receiver.digicode1 || "",
//     digicode2: data.receiver.digicode2 || "",
//     intercomid: data.receiver.intercomid || "",
//     vinfo1: data.receiver.vinfo1 || "",
//     vinfo2: data.receiver.vinfo2 || "",
//   },

//   // ADD THIS - retourAddress object (usually same as shipper)
//   retourAddress: {
//     name: data.shipper.name,
//     countryPrefix: data.shipper.countryPrefix,
//     zipCode: data.shipper.zipCode,
//     city: data.shipper.city,
//     street: data.shipper.street,
//     phoneNumber: data.shipper.phoneNumber || "",
//     faxNumber: data.shipper.faxNumber || "",
//     geoX: data.shipper.geoX || "",
//     geoY: data.shipper.geoY || "",
//   },

//   shippingdate: new Date()
//     .toLocaleDateString("fr-FR")
//     .replace(/\//g, "."),

//   services: {
//     consolidation: {
//       type: "CombinedDelivery",
//     },
//   },

//   //slaves: data.slaves
//   slaves: {
//     SlaveRequest: data.slaves  // If data.slaves is already an array of slave objects
//   }
// };
    console.log("shipment Request:",JSON.stringify(request, null, 2))
    // CREATE MULTI SHIPMENT
    const response =
      await client.CreateMultiShipmentBcAsync({request});

    /*
      IMPORTANT:

      CreateMultiShipmentBc
      returns shipment numbers only.

      To get labels we must call GetLabelBc
      for each shipment.
    */
    console.log("Multishipment response",JSON.stringify(response, null, 2) )
   const multiShipment = response?.[0]?.CreateMultiShipmentBcResult;

if (!multiShipment) {
  throw new Error("No shipment returned from DPD");
}

// Handle different possible structures of shipments
let shipments = [];

if (multiShipment.shipments) {
  if (Array.isArray(multiShipment.shipments)) {
    shipments = multiShipment.shipments;
  } else if (multiShipment.shipments.ShipmentBc) {
    shipments = multiShipment.shipments.ShipmentBc;
    if (!Array.isArray(shipments)) {
      shipments = [shipments];
    }
  }
}

if (!shipments.length) {
  throw new Error("No shipments found in response");
}

const labels = [];

for (const shipment of shipments) {
  const barcodeId = shipment?.Shipment?.BarcodeId;
  
  if (!barcodeId) continue;
  
  // CORRECTED: Proper request structure based on WSDL
  const labelRequest = {
    request: {
      customer: {
        countrycode: Number(process.env.DPD_COUNTRY_CODE),
        centernumber: Number(process.env.DPD_CENTER_NUMBER),
        number: Number(process.env.DPD_CUSTOMER_NUMBER),
      },
      shipmentNumber: barcodeId,
      labelType: {
        type: "PDF_A6",  // NOTE: lowercase 'type', not 'Type'
      },
      // Optional fields (include if needed)
      // refnrasbarcode: false,
      // injectionHub: "",
      // bic3data: { mode: "OnlyStdLabels" },
      // referenceInBarcode: { type: "Referencenumber" },
      // overrideShipperLabelAddress: null
    }
  };

  // CORRECTED: Pass labelRequest directly, not wrapped in another object
  const labelResponse = await client.GetLabelBcAsync(labelRequest);
  const result = labelResponse?.[0]?.GetLabelBcResult;
  
  if (!result?.labels) {
    console.warn(`No labels returned for barcode ${barcodeId}`);
    continue;
  }
  
  // Handle different possible label structures based on WSDL
  let shipmentLabels = [];
  if (result.labels.Label) {
    // Handle Label[] array
    shipmentLabels = Array.isArray(result.labels.Label) 
      ? result.labels.Label 
      : [result.labels.Label];
  } else if (Array.isArray(result.labels)) {
    shipmentLabels = result.labels;
  }
  
  shipmentLabels.forEach((label, index) => {
    // The label content is in the 'label' property (lowercase)
    const labelData = label.label || label.Label;
    if (labelData) {
      labels.push({
        name: `label-${barcodeId}${shipmentLabels.length > 1 ? `-${index + 1}` : ''}.pdf`,
        buffer: Buffer.from(labelData, "base64"),
      });
    }
  });
}

if (!labels.length) {
  throw new Error("No labels generated");
}
const mergedPdfBuffer = await this.mergePDFs(labels);
    
    // Create ZIP with the single merged PDF
    return await this.createZip([{
      name: `labels-${Date.now()}.pdf`,
      buffer: mergedPdfBuffer
    }]);
  },

  async mergePDFs(pdfFiles) {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Loop through each PDF file
    for (const file of pdfFiles) {
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(file.buffer);
      
      // Copy all pages from the loaded PDF to the merged PDF
      const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }
    
    // Save the merged PDF
    return await mergedPdf.save();
  },
  async createZip(files) {
    const zip = new AdmZip();
    
    files.forEach((file) => {
      zip.addFile(file.name, file.buffer);
    });
    
    return zip.toBuffer();
  },
};