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

    console.log("✅ GLS token generated", cachedToken);

    return cachedToken;
  } catch (err) {
    strapi.log.error("❌ GLS token error", err?.response?.data || err.message);
    throw new Error("GLS token failed");
  }
}

/**
 * 2. GENERATE GLS LABEL
 */
async function generateShipment(payload) {
  try {
    console.log("payload", payload);
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
            Name1: payload.receiver.name,
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
    strapi.log.info("✅ calling gls endpoint");
    const response = await axios.post(SHIPMENT_URL, glsBody, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/glsVersion1+json",
        Accept: "application/glsVersion1+json, application/json",
      },
    });

    strapi.log.info("✅ GLS label generated");
    console.log("✅ data", response.data);

    const printData = response?.data?.CreatedShipment?.PrintData;

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
  //   } catch (err) {
  //     strapi.log.error(
  //       "❌ GLS shipment error",
  //       err?.response?.data || err.message,
  //     );
  //     throw new Error("GLS label generation failed");
  //   }
}

module.exports = {
  getAccessToken,
  generateShipment,
};
