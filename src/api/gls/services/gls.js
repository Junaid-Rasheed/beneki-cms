const axios = require("axios");

// const TOKEN_URL = "https://api-sandbox.gls-group.net/oauth2/v2/token";

// const SHIPMENT_URL =
//   "https://api-sandbox.gls-group.net/shipit-farm/v1/backend/rs/shipments";

const TOKEN_URL = "https://api.gls-group.net/oauth2/v2/token";

const SHIPMENT_URL =
  "https://api.gls-group.net/shipit-farm/v1/backend/rs/shipments";

const TRACKING_DETAILS_URL =
  "https://api.gls-group.net/shipit-farm/v1/backend/rs/tracking/parceldetails";

const TRACKING_PARCELS_URL =
  "https://api.gls-group.net/shipit-farm/v1/backend/rs/tracking/parcels";

const GLS_STATUS_RANK = {
  DATA_RECEIVED: 1,
  PICKUP: 2,
  HUB: 3,
  IN_DELIVERY: 4,
  NOT_DELIVERED: 5,
  DELIVERED: 6,
};

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
 * Match order items to a slave referencenumber (`{variation}{productId}` tokens).
 * Longest productId wins so shorter IDs that are suffixes of longer ones
 * do not false-match.
 */
function matchOrderItemsByReference(orderItems, referenceNumber) {
  const items = Array.isArray(orderItems) ? orderItems : [];
  const tokens = extractTokens(referenceNumber);
  if (!items.length || !tokens.length) return [];

  const sorted = [...items].sort(
    (a, b) =>
      String(b.productId || "").length - String(a.productId || "").length,
  );

  const matched = new Map();
  for (const token of tokens) {
    const upper = String(token).toUpperCase();
    for (const item of sorted) {
      const pid = String(item.productId || "").toUpperCase();
      if (!pid || !upper.endsWith(pid)) continue;

      const prefix = upper.slice(0, upper.length - pid.length);
      if (prefix !== "" && !/^\d+(?:\.\d+)?$/.test(prefix)) continue;

      const key = item.documentId || item.id;
      if (key != null) matched.set(key, item);
      break;
    }
  }

  return [...matched.values()];
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
            ContactPerson: payload.receiver.name?.trim().slice(0, 40) || "",
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

      const parcelLabel = printData?.[i]?.Data;

      // Create tracking record
      const tracking = await strapi
        .documents("api::shipment-tracking.shipment-tracking")
        .create({
          data: {
            barCodeId: parcel.TrackID,
            barCode: parcel.ParcelNumber,
            barCodeSource: 0,
            labelData: parcelLabel ? [parcelLabel] : null,
          },
        });

      const orderItems = Array.isArray(order?.orderItems)
        ? order.orderItems
        : [];

      if (orderItems.length === 0) {
        strapi.log.warn(`No order items found for order ${payload.orderId}`);
        continue;
      }

      const matchedItems = matchOrderItemsByReference(
        orderItems,
        slave.referencenumber,
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
    // =========================
    // SAVE GLS ZPL LABELS — only when autoprint enabled
    // Manual API calls omit autoPrint → still enqueue (autoPrint !== false)
    // =========================
    if (payload.autoPrint !== false) {
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

      await strapi.documents("api::print-labels-job.print-labels-job").create({
        data: {
          orderNumber: payload.orderNumber,
          zpl: zplLabels, // keep Base64, same format expected by printer worker
          labelStatus: "Pending",
          attempts: 0,
        },
      });
    } else {
      strapi.log.info(
        `Skipping print job for ${payload.orderNumber} (user.autoprint=false)`,
      );
    }
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

/**
 * Normalize GLS API status enum / history StatusCode / description → canonical enum.
 * @see https://shipit.gls-group.com/webservices/4_0_F3/doxygen/WS-REST-API/rest_tracking.html
 */
function normalizeGlsStatus(statusCode, description = "") {
  const code = String(statusCode || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  const desc = String(description || "").toLowerCase();

  // Must run before DELIVERED — "not delivered" also contains "delivered"
  if (
    code === "NOT_DELIVERED" ||
    /not[\s_-]*delivered|undeliver|non[\s_-]*livr|nicht[\s_-]*zugestellt|no[\s_-]*entregad|non[\s_-]*consegnat/.test(
      desc,
    )
  ) {
    return "NOT_DELIVERED";
  }

  if (
    code === "DELIVERED" ||
    /delivered|livr[ée]|zugestellt|entregado|consegnat/.test(desc)
  ) {
    return "DELIVERED";
  }

  if (
    code === "IN_DELIVERY" ||
    /in[_ ]?delivery|out for delivery|en livraison|zustellung|in consegna/.test(
      desc,
    )
  ) {
    return "IN_DELIVERY";
  }

  if (
    code === "HUB" ||
    /hub|final parcel|depot|parcel center|centre de tri|sort/.test(desc)
  ) {
    return "HUB";
  }

  if (
    code === "PICKUP" ||
    /pickup|picked up|enlev|collected|abgeholt|ritirat/.test(desc)
  ) {
    return "PICKUP";
  }

  if (
    code === "DATA_RECEIVED" ||
    /data[_ ]?received|preadvice|pre.?advice|données reçues|avis/.test(desc)
  ) {
    return "DATA_RECEIVED";
  }

  if (code === "CANCELLED" || /cancel/.test(desc)) {
    return "CANCELLED";
  }

  // Pass through unknown codes that already look like enums
  if (GLS_STATUS_RANK[code] != null) return code;
  return null;
}

/**
 * Map GLS ShipIT API status to orderStatus.
 */
function mapGlsStatusToOrderStatus(glsStatus) {
  switch (normalizeGlsStatus(glsStatus) || String(glsStatus || "").toUpperCase()) {
    case "DATA_RECEIVED":
      return "Preadvice";
    case "PICKUP":
      return "In transit";
    case "HUB":
      return "Final parcel center";
    case "IN_DELIVERY":
      return "In delivery";
    case "NOT_DELIVERED":
      return "Not delivered";
    case "DELIVERED":
      return "delivered";
    default:
      return null;
  }
}

function parseGlsEventDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function eventDateKey(event) {
  return String(event?.Date || event?.DateTime || event?.InitialDate || "");
}

function eventStatusCode(event) {
  return (
    event?.StatusCode ||
    event?.statusCode ||
    event?.Status ||
    event?.TrackTraceStatus ||
    null
  );
}

function eventDescription(event) {
  return event?.Description || event?.description || "";
}

/**
 * UnitDetail has no top-level Status — current state is the latest History entry
 * (StatusCode + Description). DeliveryDate set ⇒ delivered.
 */
function extractFromParcelDetails(data) {
  const detail = data?.UnitDetail || data?.unitDetail;
  if (!detail) return { glsStatus: null, eventDate: null };

  if (detail.DeliveryDate) {
    return {
      glsStatus: "DELIVERED",
      eventDate: parseGlsEventDate(detail.DeliveryDate),
    };
  }

  const history = detail.History || detail.history;
  const events = Array.isArray(history) ? history : history ? [history] : [];

  let bestStatus = null;
  let bestRank = -1;
  let bestDate = null;

  for (const event of events) {
    const normalized = normalizeGlsStatus(
      eventStatusCode(event),
      eventDescription(event),
    );
    if (!normalized || normalized === "CANCELLED") continue;

    const rank = GLS_STATUS_RANK[normalized] ?? -1;
    const date = parseGlsEventDate(eventDateKey(event));

    // Prefer highest lifecycle rank; tie-break on newest event date
    const newer =
      date && bestDate ? date.getTime() > bestDate.getTime() : Boolean(date);
    if (rank > bestRank || (rank === bestRank && newer)) {
      bestRank = rank;
      bestStatus = normalized;
      bestDate = date || bestDate;
    }
  }

  if (bestStatus) {
    return { glsStatus: bestStatus, eventDate: bestDate };
  }

  const direct = normalizeGlsStatus(
    detail.Status || detail.TrackTraceStatus,
    "",
  );
  return {
    glsStatus: direct,
    eventDate: parseGlsEventDate(detail.InitialDate || detail.DeliveryDate),
  };
}

function extractFromParcelsList(data) {
  const items = data?.UnitItems || data?.unitItems;
  const list = Array.isArray(items) ? items : items ? [items] : [];
  if (!list.length) return { glsStatus: null, eventDate: null };

  let bestStatus = null;
  let bestRank = -1;
  let bestDate = null;

  for (const item of list) {
    const normalized = normalizeGlsStatus(item.Status || item.status, "");
    if (!normalized || normalized === "CANCELLED") continue;
    const rank = GLS_STATUS_RANK[normalized] ?? -1;
    const date = parseGlsEventDate(item.InitialDate || item.initialDate);
    if (rank > bestRank) {
      bestRank = rank;
      bestStatus = normalized;
      bestDate = date;
    }
  }

  return { glsStatus: bestStatus, eventDate: bestDate };
}

function trackingHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/glsVersion1+json",
    Accept: "application/glsVersion1+json, application/json",
  };
}

/**
 * Fetch the latest GLS scan for a parcel TrackID (barCodeId).
 * Uses parceldetails History.StatusCode, falls back to /parcels Status.
 */
async function getParcelTrace(trackId) {
  if (!trackId) {
    throw new Error("trackId is required");
  }

  const token = await getAccessToken();
  const id = String(trackId);

  let detailsData = null;
  try {
    const detailsResponse = await axios.post(
      TRACKING_DETAILS_URL,
      { TrackID: id },
      { headers: trackingHeaders(token) },
    );
    detailsData = detailsResponse.data;
    const fromDetails = extractFromParcelDetails(detailsData);
    if (fromDetails.glsStatus) {
      return {
        glsStatus: fromDetails.glsStatus,
        eventDate: fromDetails.eventDate,
        orderStatus: mapGlsStatusToOrderStatus(fromDetails.glsStatus),
        raw: detailsData,
      };
    }
  } catch (err) {
    const message = `[GLS Tracking] parceldetails failed for ${id}: ${err.message}`;
    if (typeof strapi !== "undefined" && strapi?.log) {
      strapi.log.warn(message);
    } else {
      console.warn(message);
    }
  }

  // Fallback: findParcels returns UnitItems[].Status (requires date window)
  const today = new Date();
  const dateTo = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setDate(from.getDate() - 60);
  const dateFrom = from.toISOString().slice(0, 10);

  const parcelsResponse = await axios.post(
    TRACKING_PARCELS_URL,
    { TrackID: id, DateFrom: dateFrom, DateTo: dateTo },
    { headers: trackingHeaders(token) },
  );

  const fromList = extractFromParcelsList(parcelsResponse.data);
  if (!fromList.glsStatus) {
    if (typeof strapi !== "undefined" && strapi?.log) {
      strapi.log.warn(
        `[GLS Tracking] No status for ${id}. detailsKeys=${Object.keys(detailsData || {}).join(",") || "n/a"} parcelsKeys=${Object.keys(parcelsResponse.data || {}).join(",") || "n/a"}`,
      );
    }
    return null;
  }

  return {
    glsStatus: fromList.glsStatus,
    eventDate: fromList.eventDate,
    orderStatus: mapGlsStatusToOrderStatus(fromList.glsStatus),
    raw: parcelsResponse.data,
  };
}

module.exports = {
  getAccessToken,
  generateGlsShipment,
  mapGlsStatusToOrderStatus,
  normalizeGlsStatus,
  getParcelTrace,
};
