const fs = require("fs");
const axios = require("axios");

// ================= CONFIG =================
const STRAPI_URL = "https://beneki-cms.onrender.com";
const API_TOKEN =
  "44cf8e468dbd881753e790053af228690393e64654188211f0e94f6f5d0ddf068fb9db0e3f0cd4c0967a3cd07fb66388cc05744647fc31c4104fb5820a5e9871170419bac4e301448464c33578a7d8e92115d15c192017e34fc9f3423e6bf639695ca71f42e6679a064756343f1ed3df7b45a963e7efb78931ad9f9dc93e7572";

const HEADERS = {
  //Authorization: `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json",
};

// ================= LOAD DATA =================
const raw = JSON.parse(fs.readFileSync("orders.fixed.json", "utf8"));
const orders = raw.data;

// ================= ORDER STATUS =================
const ORDER_STATUS_MAP = {
  "wc-refunded": "refund",
  "wc-failed": "cancelled",
  "wc-processing": "processing",
  "wc-on-hold": "pending",
  "wc-cancelled": "cancelled",
  "wc-partial-shipped": "Partially Shipped",
  "wc-completed": "delivered",
};

function mapOrderStatus(value) {
  if (!value) return "pending";
  return ORDER_STATUS_MAP[value.toLowerCase().trim()] || "pending";
}

// ================= PAYMENT METHOD =================
const PAYMENT_METHOD_MAP = {
  computop_onetime: "credit_card",
  stripe: "credit_card",
  stripe_sepa: "credit_card",
  bacs: "bank_transfer",
  paypal: "paypal",
};

function mapPaymentMethod(value) {
  if (!value) return "other";
  return PAYMENT_METHOD_MAP[value.toLowerCase().trim()] || "other";
}

// ================= PAYMENT STATUS =================
function mapPaymentStatus(paymentMethod, transactionId, orderStatus) {
  const method = mapPaymentMethod(paymentMethod);
  const hasTransaction = !!transactionId && transactionId.trim() !== "";
  const status = orderStatus?.toLowerCase();

  if (method === "credit_card" || method === "paypal") {
    return hasTransaction ? "paid" : "pending";
  }

  if (method === "bank_transfer") {
    return status === "wc-completed" ? "paid" : "pending";
  }

  return status === "wc-completed" ? "paid" : "pending";
}

// ================= USER LOOKUP =================
async function getUserIdByEmail(email) {
  if (!email) return null;

  const res = await axios.get(
    `${STRAPI_URL}/api/users?filters[email][$eq]=${email}`,
    { headers: HEADERS }
  );

  return res.data?.[0]?.id || null;
}

// ================= ORDER NUMBER (FIXED) =================
let currentOrderNumber = 0;

async function initOrderCounter() {
  const res = await axios.get(
    `${STRAPI_URL}/api/orders?pagination[pageSize]=1000`,
    { headers: HEADERS }
  );

  const orders = res.data?.data || [];
  let max = 0;

  for (const o of orders) {
    const num = o.attributes?.orderNumber;
    if (num?.startsWith("ORD-")) {
      const n = parseInt(num.replace("ORD-", ""), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    }
  }

  currentOrderNumber = max;
  console.log(`🔢 Starting from order number: ORD-${max.toString().padStart(5, "0")}`);
}
function toStrapiDate(value) {
  if (!value) return null;

  // If already a Date object
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle SQL datetime string: YYYY-MM-DD HH:mm:ss
  if (typeof value === "string") {
    const iso = value.replace(" ", "T") + "Z";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Handle timestamp
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

function getNextOrderNumber() {
  currentOrderNumber += 1;
  return `ORD-${currentOrderNumber.toString().padStart(5, "0")}`;
}

// ================= MIGRATION =================
async function migrateOrders() {
  await initOrderCounter();

  for (const o of orders) {
    try {
      const orderNumber = getNextOrderNumber();
      const userId = await getUserIdByEmail(o.UserEmail);

      const payload = {
        data: {
          orderNumber,
          oldOrderId: o.OldOrderId.toString(),
          total: o.Total,
          subTotal: o.Total - o.VAT,
          vat: o.VAT,
          paymentMethod: mapPaymentMethod(o.PaymentMethod),
          orderStatus: mapOrderStatus(o.OrderStatus),
          paymentStatus: mapPaymentStatus(
            o.PaymentMethod,
            o.TransactionId,
            o.OrderStatus
          ),
          notes: o.OrderNote || "",
          user: userId,
          orderCreatedDate: toStrapiDate(o.CreatedDate),
          invoiceId: o.InvoiceId
        },
      };

      await axios.post(`${STRAPI_URL}/api/orders`, payload, {
        headers: HEADERS,
      });

      console.log(`✅ Order migrated: ${orderNumber}`);
    } catch (err) {
      console.error(
        `❌ Failed order ${o.OldOrderId}`,
        err.response?.data || err.message
      );
    }
  }
}

migrateOrders();