"use strict";

const soap = require("soap");
const axios = require("axios");
const https = require("https");
const AdmZip = require("adm-zip");
const path = require("path");

const WSDL_PATH = path.join(__dirname, "../../../wsdl/dpd.wsdl");
const WEBTRACE_WSDL_PATH = path.join(
  __dirname,
  "../../../wsdl/dpd-webtrace.wsdl",
);
const WEBTRACE_ENDPOINT =
  "https://webtrace.dpd.fr/trace-service/Webtrace_Service.asmx";

function extractTokens(referenceNumber) {
  if (!referenceNumber) return [];

  return referenceNumber
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function getDpdCustomer() {
  return {
    countrycode: Number(process.env.DPD_COUNTRY_CODE),
    centernumber: Number(process.env.DPD_CENTER_NUMBER),
    number: Number(process.env.DPD_CUSTOMER_NUMBER),
  };
}

/**
 * node-soap's default HTTP client gets ECONNRESET against webtrace.dpd.fr;
 * axios + keepAlive:false is reliable.
 */
function createWebtraceHttpClient() {
  const httpsAgent = new https.Agent({ keepAlive: false });

  return {
    request(rurl, data, callback, exheaders) {
      axios
        .post(rurl, data, {
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "Content-Length": Buffer.byteLength(data),
            ...(exheaders || {}),
          },
          httpsAgent,
          timeout: 30000,
          transformResponse: [(body) => body],
          validateStatus: () => true,
        })
        .then((res) => callback(null, res, res.data))
        .catch((err) => callback(err));
    },
  };
}

async function createWebtraceClient() {
  const client = await soap.createClientAsync(WEBTRACE_WSDL_PATH, {
    disableCache: true,
    forceSoap12Headers: false,
  });

  client.setEndpoint(WEBTRACE_ENDPOINT);
  client.httpClient = createWebtraceHttpClient();

  // Namespace must include trailing slash (http://www.cargonet.software/)
  client.addSoapHeader({
    UserCredentials: {
      userid: process.env.DPD_USER,
      password: process.env.DPD_PASSWORD,
      attributes: {
        xmlns: "http://www.cargonet.software/",
      },
    },
  });

  return client;
}

function normalizeTraces(traces) {
  if (!traces) return [];
  const list = traces.clsTrace ?? traces;
  return Array.isArray(list) ? list : [list];
}

function getLatestTrace(traces) {
  if (!traces.length) return null;

  return traces.reduce((latest, trace) => {
    if (!latest) return trace;

    const latestKey = `${latest.ScanDate || ""}${latest.ScanTime || ""}`;
    const currentKey = `${trace.ScanDate || ""}${trace.ScanTime || ""}`;
    return currentKey >= latestKey ? trace : latest;
  }, null);
}

/**
 * Map DPD Webtrace StatusNumber / StatusDescription to orderStatus.
 * Codes observed from DPD FR Webtrace (e.g. 40=livré, 30=en livraison, 20=acheminement).
 */
function mapTraceToOrderStatus(statusNumber, statusDescription = "") {
  const code = Number(statusNumber);
  const desc = String(statusDescription).toLowerCase();

  if (
    [13, 23, 40].includes(code) ||
    /livr[ée]|delivered|remis au destinataire|retir[ée] au point/.test(desc)
  ) {
    return "delivered";
  }

  if (
    [3, 30].includes(code) ||
    /en cours de livraison|out for delivery|en livraison|chez le livreur/.test(
      desc,
    )
  ) {
    return "Parcel out for delivery";
  }

  if (
    [2, 9].includes(code) ||
    /centre de (livraison|tri|distribution)|delivery (centre|center|depot)|au d[ée]p[ôo]t|entrep[ôo]t|at delivery/.test(
      desc,
    )
  ) {
    return "At delivery centre";
  }

  if (
    [5, 10, 15, 28].includes(code) ||
    /pris en charge|remis [àa] dpd|handed to dpd|enlev[ée]|pick.?up|collect[ée] par dpd/.test(
      desc,
    )
  ) {
    return "Parcel handed to DPD";
  }

  if (
    [1, 12, 17, 20].includes(code) ||
    /acheminement|in transit|en transit|hub|consolidation|chargement/.test(desc)
  ) {
    return "In transit";
  }

  return null;
}

module.exports = {
  mapTraceToOrderStatus,

  /**
   * Fetch the latest DPD scan for a shipment barcode (barCodeId).
   * Uses GetLastTraceBc; Customer is required (omitting it → CustomerPermissionDenied).
   * Falls back to GetShipmentTraceSingle if needed.
   */
  async getParcelTrace(shipmentNumber) {
    if (!shipmentNumber) {
      throw new Error("shipmentNumber is required");
    }

    const client = await createWebtraceClient();
    const customer = getDpdCustomer();

    try {
      const lastTraceResponse = await client.GetLastTraceBcAsync({
        request: {
          Customer: customer,
          Language: "FR",
          Parcels: {
            string: [String(shipmentNumber)],
          },
        },
      });

      const lastTraceResult =
        lastTraceResponse?.[0]?.GetLastTraceBcResult?.GetLastTraceBcResponse;
      const lastTraceEntries = Array.isArray(lastTraceResult)
        ? lastTraceResult
        : lastTraceResult
          ? [lastTraceResult]
          : [];
      const lastTrace = lastTraceEntries[0]?.Trace;

      if (lastTrace?.StatusNumber != null) {
        return {
          statusNumber: lastTrace.StatusNumber,
          statusDescription: lastTrace.StatusDescription || "",
          scanDate: lastTrace.ScanDate || null,
          scanTime: lastTrace.ScanTime || null,
          orderStatus: mapTraceToOrderStatus(
            lastTrace.StatusNumber,
            lastTrace.StatusDescription,
          ),
          raw: lastTrace,
        };
      }
    } catch (err) {
      const message = `[DPD Webtrace] GetLastTraceBc failed for ${shipmentNumber}: ${err.message}`;
      if (typeof strapi !== "undefined" && strapi?.log) {
        strapi.log.warn(message);
      } else {
        console.warn(message);
      }
    }

    const traceResponse = await client.GetShipmentTraceSingleAsync({
      request: {
        Customer: customer,
        Language: "FR",
        ShipmentNumber: String(shipmentNumber),
        ExpandContainerMode: "MasterOnly",
        GetImages: false,
        GetPhotos: false,
        GetParsedInfo: false,
        GetServices: false,
      },
    });

    const shipmentTrace = traceResponse?.[0]?.GetShipmentTraceSingleResult;
    const traces = normalizeTraces(shipmentTrace?.Traces);
    const latest = getLatestTrace(traces);

    if (!latest) {
      return null;
    }

    return {
      statusNumber: latest.StatusNumber,
      statusDescription: latest.StatusDescription || "",
      scanDate: latest.ScanDate || null,
      scanTime: latest.ScanTime || null,
      orderStatus: mapTraceToOrderStatus(
        latest.StatusNumber,
        latest.StatusDescription,
      ),
      raw: latest,
    };
  },

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

    const chunkArray = (array, size) => {
      const result = [];
      for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
      }
      return result;
    };

    // ✅ FIXED: ZPL LABEL FETCH (NO PDF)
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
            type: "ZPL_A6",
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
            name: `label-${barcodeId}${shipmentLabels.length > 1 ? `-${index + 1}` : ""}.zpl`,
            buffer: Buffer.from(labelData, "utf-8"), // ✅ ZPL is TEXT, not base64 PDF
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

    // =========================
    // FINAL VALIDATION
    // =========================
    if (!allLabels.length) {
      throw new Error("No labels generated");
    }

    const existing = await strapi.db
      .query("api::print-labels-job.print-labels-job")
      .findOne({
        where: {
          orderNumber: data.orderNumber,
        },
      });

    if (existing) {
      throw new Error(`Order ${data.orderNumber} already exists`);
    }
    // =========================
    // OPTIONAL: SAVE TO STRAPI (ZPL STORAGE)
    // =========================
    await strapi.documents("api::print-labels-job.print-labels-job").create({
      data: {
        orderNumber: data.orderNumber,
        zpl: allLabels.map((l) => l.buffer.toString("utf-8")), // ✅ store raw ZPL
        labelStatus: "Pending",
        attempts: 0,
      },
    });

    // =========================
    // CREATE ZIP (ZPL FILES)
    // =========================
    // const zip = new AdmZip();

    // allLabels.forEach((file) => {
    //   zip.addFile(file.name, file.buffer);
    // });

    // const zipBuffer = zip.toBuffer();

    // return zipBuffer;
    return true;
  },
};
