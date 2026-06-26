"use strict";

const soap = require("soap");
const AdmZip = require("adm-zip");
const { PassThrough } = require("stream");
const { PDFDocument } = require("pdf-lib");

const path = require("path");

const WSDL_PATH = path.join(__dirname, "../../../wsdl/dpd.wsdl");
function extractTokens(referenceNumber) {
  if (!referenceNumber) return [];

  return referenceNumber
    .split(/\s+/) // split by spaces
    .map((t) => t.trim())
    .filter(Boolean);
}
module.exports = {
  async generateShipment(data) {
    
    const client = await soap.createClientAsync(WSDL_PATH, {
      disableCache: true,
    });

    

    const soapHeader = {
      UserCredentials: {
        userid: process.env.DPD_USER,
        password: process.env.DPD_PASSWORD,
        attributes: {
          xmlns: "http://www.cargonet.software",
        },
      },
    };

    client.addSoapHeader(soapHeader);

    const allLabels = [];

    // Helper: chunk array into groups of 5
    const chunkArray = (array, size) => {
      const result = [];

      for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
      }

      return result;
    };

    // Helper: fetch labels for shipment
    const fetchLabels = async (barcodeId) => {
      const labelRequest = {
        request: {
          customer: {
            countrycode: Number(process.env.DPD_COUNTRY_CODE),
            centernumber: Number(process.env.DPD_CENTER_NUMBER),
            number: Number(process.env.DPD_CUSTOMER_NUMBER),
          },
          shipmentNumber: barcodeId,
          labelType: {
            type: "PDF_A6",
          },
        },
      };

      const labelResponse = await client.GetLabelBcAsync(labelRequest);

      const result = labelResponse?.[0]?.GetLabelBcResult;

      if (!result?.labels) {
        console.warn(`No labels returned for barcode ${barcodeId}`);
        return [];
      }

      let shipmentLabels = [];

      if (result.labels.Label) {
        shipmentLabels = Array.isArray(result.labels.Label)
          ? result.labels.Label
          : [result.labels.Label];
      } else if (Array.isArray(result.labels)) {
        shipmentLabels = result.labels;
      }

      return shipmentLabels
        .map((label, index) => {
          const labelData = label.label || label.Label;

          if (!labelData) return null;

          return {
            name: `label-${barcodeId}${
              shipmentLabels.length > 1 ? `-${index + 1}` : ""
            }.pdf`,
            buffer: Buffer.from(labelData, "base64"),
          };
        })
        .filter(Boolean);
    };

    const slaves = data?.slaves?.SlaveRequest || [];

    const hasMultipleSlaves = slaves.length > 1;

    // SINGLE SHIPMENT
    if (!hasMultipleSlaves) {
      const request = {
        customer_countrycode: Number(process.env.DPD_COUNTRY_CODE),

        customer_centernumber: Number(process.env.DPD_CENTER_NUMBER),

        customer_number: Number(process.env.DPD_CUSTOMER_NUMBER),

        shipperaddress: {
          name: data.shipper.name,
          countryPrefix: data.shipper.countryPrefix,
          zipCode: data.shipper.zipCode,
          city: data.shipper.city,
          street: data.shipper.street,
          phoneNumber: data.shipper.phoneNumber,
        },

        receiveraddress: {
          name: data.receiver.companyName || data.receiver.name,
          countryPrefix: data.receiver.countryPrefix,
          zipCode: data.receiver.zipCode,
          city: data.receiver.city,
          street: data.receiver.street,
          phoneNumber: data.receiver.phoneNumber,
        },

        receiverinfo: {
          contact: data.receiver.name || "",
        },

        shippingdate: new Date()
          .toLocaleDateString("fr-FR")
          .replace(/\//g, "."),

        services: {
          contact: {
            email: data.receiver.email || "",
            type: "AutomaticMail",
          },
        },

        weight: slaves?.[0]?.weight || "",
        referencenumber: slaves?.[0]?.referencenumber || "",
      };

      const response = await client.CreateShipmentBcAsync({ request });
      
      const shipment = response?.[0]?.CreateShipmentBcResult?.ShipmentBc?.[0];

      // Fetch order with order items
      const order = await strapi.documents("api::order.order").findOne({
        documentId: data.orderId, // or data.orderId if that's your documentId
        populate: {
          shipment_trackings: true,
          orderItems: {
            populate: {
              shipment_trackings: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error(`Order not found: ${data.documentId}`);
      }

      // Create shipment tracking record
      const tracking = await strapi
        .documents("api::shipment-tracking.shipment-tracking")
        .create({
          data: {
            barCodeId: shipment.Shipment.BarcodeId,
            barCode: shipment.Shipment.BarCode,
            barCodeSource: shipment.Shipment.BarcodeSource,
          },
        });

      // Attach tracking to order
      await strapi.documents("api::order.order").update({
        documentId: order.documentId,
        data: {
          shipment_trackings: {
            connect: [tracking.documentId],
          },
        },
      });

      // Since this is a SINGLE shipment,
      // connect the same tracking to all order items
      for (const item of order.orderItems || []) {
        await strapi.documents("api::order-item.order-item").update({
          documentId: item.documentId,
          data: {
            shipment_trackings: {
              connect: [tracking.documentId],
            },
          },
        });
      }

     
      const barcodeId = shipment?.Shipment?.BarcodeId;

      if (!barcodeId) {
        throw new Error("No barcode returned from DPD");
      }

      const labels = await fetchLabels(barcodeId);

      allLabels.push(...labels);
    }

    // MULTI SHIPMENT WITH CHUNKS OF 5
    else {
      const slaveChunks = chunkArray(slaves, 5);

      

      for (let chunkIndex = 0; chunkIndex < slaveChunks.length; chunkIndex++) {
        const chunk = slaveChunks[chunkIndex];
       

        // =========================
        // SINGLE SHIPMENT FOR 1 ITEM CHUNK
        // =========================
        if (chunk.length === 1) {
          const singleSlave = chunk[0];

          const request = {
            customer_countrycode: Number(process.env.DPD_COUNTRY_CODE),

            customer_centernumber: Number(process.env.DPD_CENTER_NUMBER),

            customer_number: Number(process.env.DPD_CUSTOMER_NUMBER),

            shipperaddress: {
              name: data.shipper.name,
              countryPrefix: data.shipper.countryPrefix,
              zipCode: data.shipper.zipCode,
              city: data.shipper.city,
              street: data.shipper.street,
              phoneNumber: data.shipper.phoneNumber,
            },

            receiveraddress: {
              name: data.receiver.companyName || data.receiver.name,
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
              vinfo2: data.receiver.deliveryInstruction2 || "",
            },

            shippingdate: new Date()
              .toLocaleDateString("fr-FR")
              .replace(/\//g, "."),

            weight: singleSlave.weight || "",
            referencenumber: singleSlave.referencenumber || "",
          };

          

          const response = await client.CreateShipmentBcAsync({
            request,
          });
         
          const shipment =
            response?.[0]?.CreateShipmentBcResult?.ShipmentBc?.[0];

          const order = await strapi.documents("api::order.order").findOne({
            documentId: data.orderId, // or data.orderId if that's your documentId
            populate: {
              shipment_trackings: true,
              orderItems: {
                populate: {
                  shipment_trackings: true,
                },
              },
            },
          });

          if (!order) {
            throw new Error(`Order not found: ${data.documentId}`);
          }

          // Create shipment tracking record
          const tracking = await strapi
            .documents("api::shipment-tracking.shipment-tracking")
            .create({
              data: {
                barCodeId: shipment.Shipment.BarcodeId,
                barCode: shipment.Shipment.BarCode,
                barCodeSource: shipment.Shipment.BarcodeSource,
              },
            });

          // Attach tracking to order
          await strapi.documents("api::order.order").update({
            documentId: order.documentId,
            data: {
              shipment_trackings: {
                connect: [tracking.documentId],
              },
            },
          });

          // Since this is a SINGLE shipment,
          // connect the same tracking to all order items
          for (const item of order.orderItems || []) {
            await strapi.documents("api::order-item.order-item").update({
              documentId: item.documentId,
              data: {
                shipment_trackings: {
                  connect: [tracking.documentId],
                },
              },
            });
          }

          
          const barcodeId = shipment?.Shipment?.BarcodeId;

          if (!barcodeId) {
            console.warn("No barcode returned for single shipment");
            continue;
          }

          const labels = await fetchLabels(barcodeId);

          allLabels.push(...labels);

          continue;
        }

        // =========================
        // MULTI SHIPMENT
        // =========================
        const request = {
          customer_countrycode: Number(process.env.DPD_COUNTRY_CODE),

          customer_centernumber: Number(process.env.DPD_CENTER_NUMBER),

          customer_number: Number(process.env.DPD_CUSTOMER_NUMBER),

          shipperaddress: {
            name: data.shipper.name,
            countryPrefix: data.shipper.countryPrefix,
            zipCode: data.shipper.zipCode,
            city: data.shipper.city,
            street: data.shipper.street,
            phoneNumber: data.shipper.phoneNumber,
          },

          receiveraddress: {
            name: data.receiver.companyName || data.receiver.name,
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
            vinfo2: data.receiver.deliveryInstruction2 || "",
          },

          shippingdate: new Date()
            .toLocaleDateString("fr-FR")
            .replace(/\//g, "."),

          services: {
            consolidation: {
              type: "CombinedInvoicing",
            },
            ...(chunkIndex === 0 && {
              contact: {
                email: data.receiver.email || "",
                type: "AutomaticMail",
              },
            }),
          },

          slaves: {
            SlaveRequest: chunk,
          },
        };

        
        const response = await client.CreateMultiShipmentBcAsync({
          request,
        });
        
        const multiShipment = response?.[0]?.CreateMultiShipmentBcResult;

        if (!multiShipment) {
          console.warn("No shipment returned for chunk");
          continue;
        }

        let shipments = [];

        if (multiShipment.shipments?.ShipmentBc) {
          shipments = Array.isArray(multiShipment.shipments.ShipmentBc)
            ? multiShipment.shipments.ShipmentBc
            : [multiShipment.shipments.ShipmentBc];
        }

        const order = await strapi.documents("api::order.order").findOne({
          documentId: data.orderId,
          populate: {
            orderItems: true,
          },
        });

        const masterShipment = multiShipment.mastershipment;

        if (masterShipment?.Shipment) {
          const tracking = await strapi
            .documents("api::shipment-tracking.shipment-tracking")
            .create({
              data: {
                barCodeId: masterShipment.Shipment.BarcodeId,
                barCode: masterShipment.Shipment.BarCode,
                barCodeSource: masterShipment.Shipment.BarcodeSource,
              },
            });

          await strapi.documents("api::order.order").update({
            documentId: order.documentId,
            data: {
              shipment_trackings: {
                connect: [tracking.documentId],
              },
            },
          });
        }
        for (const shipment of shipments) {
          const tracking = await strapi
            .documents("api::shipment-tracking.shipment-tracking")
            .create({
              data: {
                barCodeId: shipment.Shipment.BarcodeId,
                barCode: shipment.Shipment.BarCode,
                barCodeSource: shipment.Shipment.BarcodeSource,
              },
            });

          // Find the slave corresponding to this shipment
          // Assuming DPD preserves order
          const shipmentIndex = shipments.indexOf(shipment);
          const slave = chunk[shipmentIndex];

          if (!slave?.referencenumber) {
            continue;
          }

          const orderItemMap = new Map();
          const orderItems = Array.isArray(order?.orderItems)
            ? order.orderItems
            : [];
          for (const item of orderItems) {
            orderItemMap.set(String(item.productId), item);
          }
          if (orderItems.length === 0) {
            strapi.log.warn(`No order items found for order ${data.orderId}`);
            continue;
          }

          const tokens = extractTokens(slave.referencenumber);

          const matchedItems = orderItems.filter((item) =>
            tokens.some((token) =>
              token
                .toUpperCase()
                .endsWith(String(item.productId).toUpperCase()),
            ),
          );
 
          for (const item of matchedItems) {
            await strapi.documents("api::order-item.order-item").update({
              documentId: item.documentId,
              data: {
                shipment_trackings: {
                  connect: [tracking.documentId],
                },
              },
            });
          }

          const barcodeId = shipment?.Shipment?.BarcodeId;

          if (!barcodeId) continue;

          const labels = await fetchLabels(barcodeId);

          allLabels.push(...labels);
        }
      }
    }

    if (!allLabels.length) {
      throw new Error("No labels generated");
    }

    // Merge ALL PDFs into ONE
    const mergedPdfBuffer = await this.mergePDFs(allLabels);

    // Return ZIP with single merged PDF
    return await this.createZip([
      {
        name: `labels-${Date.now()}.pdf`,
        buffer: mergedPdfBuffer,
      },
    ]);
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
      pages.forEach((page) => mergedPdf.addPage(page));
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

