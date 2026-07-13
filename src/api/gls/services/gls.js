const axios = require("axios");

// const TOKEN_URL = "https://api-sandbox.gls-group.net/oauth2/v2/token";

// const SHIPMENT_URL =
//   "https://api-sandbox.gls-group.net/shipit-farm/v1/backend/rs/shipments";

const TOKEN_URL = "https://api.gls-group.net/oauth2/v2/token";

const SHIPMENT_URL =
  "https://api.gls-group.net/shipit-farm/v1/backend/rs/shipments";

const CLIENT_ID = process.env.GLS_CLIENT_ID;
const CLIENT_SECRET = process.env.GLS_CLIENT_SECRET;
const CONTACT_ID = process.env.GLS_CONTACT_ID;

// simple cache
let cachedToken = null;
let tokenExpiresAt = null;
function extractTokens(referenceNumber) {
  if (!referenceNumber) return [];

  return referenceNumber
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}
/**
 * 1. GET GLS TOKEN
 */
async function getAccessToken() {
  try {
    if (cachedToken && tokenExpiresAt > Date.now()) {
      return cachedToken;
    }

    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", CLIENT_ID);
    params.append("client_secret", CLIENT_SECRET);

    const response = await axios.post(TOKEN_URL, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    cachedToken = response.data.access_token;
    tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

    

    return cachedToken;
  } catch (err) {
    strapi.log.error("❌ GLS token error", err?.response?.data || err.message);
    throw new Error("GLS token failed");
  }
}

/**
 * 2. GENERATE GLS LABEL
 */
async function generateGlsShipment(payload) {
  try {
    
    const token = await getAccessToken();

    // 🔥 Build GLS body from YOUR payload
    const glsBody = {
      Shipment: {
        //ShipmentReference: [payload.orderNumber || payload.orderId],
        Middleware: "IT Supplier",
        Product: "PARCEL",

        Consignee: {
          ConsigneeID: payload.orderId?.toString() || "N/A",
          Address: {
            Name1: payload.receiver.companyName || payload.receiver.name,
            CountryCode: payload.receiver.countryPrefix,
            ZIPCode: payload.receiver.zipCode,
            City: payload.receiver.city,
            Street: payload.receiver.street.substring(0, 40),
            eMail: payload.receiver.email,
            FixedLinePhonenumber: "",
            MobilePhoneNumber: payload.receiver.phoneNumber,
            ContactPerson: payload.receiver.name,
          },
        },

        Shipper: {
          ContactID: CONTACT_ID,
          AlternativeShipperAddress: {
            Name1: payload.shipper.name,
            CountryCode: payload.shipper.countryPrefix,
            ZIPCode: payload.shipper.zipCode,
            City: payload.shipper.city,
            Street: payload.shipper.street,
          },
        },

        // ⚠️ IMPORTANT: each item = 1 label
        ShipmentUnit: (payload.slaves?.SlaveRequest || []).map((p) => ({
          Weight: p.weight || 1,
          ShipmentUnitReference: [p.referencenumber || "test"],
          Note1: payload.receiver.deliveryInstruction,
          Note2: payload.receiver.deliveryInstruction2,
        })),

        Service: [
          {
            Service: {
              ServiceName: "service_flexdelivery",
            },
          },
        ],
      },

      PrintingOptions: {
        ReturnLabels: {
          TemplateSet: "ZPL_200",
          LabelFormat: "ZEBRA",
        },
      },
    };
    
    const response = await axios.post(SHIPMENT_URL, glsBody, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/glsVersion1+json",
        Accept: "application/glsVersion1+json, application/json",
      },
    });

      const order = await strapi.documents("api::order.order").findOne({
          documentId: payload.orderId,
          populate: {
            orderItems: true,
          },
        });

    const printData = response?.data?.CreatedShipment?.PrintData;
    const parcels = response?.data?.CreatedShipment?.ParcelData;

    for (let i = 0; i < parcels.length; i++) {
      const parcel = parcels[i];
      const slave = payload.slaves?.SlaveRequest[i];

      if (!slave?.referencenumber) {
        continue;
      }

      // Create tracking record
      const tracking = await strapi
        .documents("api::shipment-tracking.shipment-tracking")
        .create({
          data: {
            barCodeId: parcel.TrackID,
            barCode: parcel.ParcelNumber,
            barCodeSource: 0,
          },
        });

      const orderItems = Array.isArray(order?.orderItems)
        ? order.orderItems
        : [];

      if (orderItems.length === 0) {
        strapi.log.warn(`No order items found for order ${data.orderId}`);
        continue;
      }

      const tokens = extractTokens(slave.referencenumber);

      const matchedItems = orderItems.filter((item) =>
        tokens.some((token) =>
          token.toUpperCase().endsWith(String(item.productId).toUpperCase()),
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
    }
    if (!printData || !printData.length) {
      throw new Error("No GLS labels generated");
    }

    // const zplLabels = printData.map((label) =>
    //   (label.Data),
    // );
    const zplLabels = printData.map((label) => label.Data);
    const existing = await strapi.db
      .query("api::print-labels-job.print-labels-job")
      .findOne({
        where: {
          orderNumber: payload.orderNumber,
        },
      });

    if (existing) {
      throw new Error(`Order ${payload.orderNumber} already exists`);
    }

    // =========================
    // SAVE GLS ZPL LABELS
    // =========================

    await strapi.documents("api::print-labels-job.print-labels-job").create({
      data: {
        orderNumber: payload.orderNumber,
        zpl: zplLabels, // keep Base64, same format expected by printer worker
        labelStatus: "Pending",
        attempts: 0,
      },
    });
  } catch (error) {
    strapi.log.error("❌ GLS shipment error");

    if (error.response) {
      strapi.log.error(`Status: ${error.response.status}`);
      strapi.log.error(JSON.stringify(error.response.data, null, 2));
      strapi.log.error(JSON.stringify(error.response.headers, null, 2));
    } else {
      strapi.log.error(error.message);
    }

    throw error;
  }
}

module.exports = {
  getAccessToken,
  generateGlsShipment,
};
