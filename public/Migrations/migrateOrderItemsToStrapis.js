const fs = require("fs");
const axios = require("axios");

// ================= CONFIG =================
const STRAPI_URL =  "https://beneki-cms.onrender.com";
const API_TOKEN = "YOUR_API_TOKEN";

const HEADERS = {
  //Authorization: `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json",
};

// ================= LOAD DATA =================
const raw = JSON.parse(fs.readFileSync("OrderItems.fixed.json", "utf8"));
const items = raw.data;

// ================= HELPERS =================

// 1️⃣ Find Order by OldOrderId
async function getOrder(oldOrderId) {
  const res = await axios.get(
    `${STRAPI_URL}/api/orders?filters[oldOrderId][$eq]=${oldOrderId}&populate=orderItems&pagination[limit]=1`,
    { headers: HEADERS }
  );

  return res.data?.data?.[0] || null;
}

// 2️⃣ Find Product by legacy ProductId
async function getProduct(productOldId) {
  const res = await axios.get(
    `${STRAPI_URL}/api/sidebar-items?filters[productOldId][$eq]=${productOldId}&pagination[limit]=1`,
    { headers: HEADERS }
  );

  const product = res.data?.data?.[0];
  if (!product) return null;

  return {
    id: product.id,
    title: product.productTitle,
  };
}

// ================= MIGRATION =================
async function migrateOrderItems() {
  for (const i of items) {
    try {
      // 🔍 Order
      const order = await getOrder(i.OldOrderId);
      if (!order) {
        console.warn(`⚠️ Order not found: ${i.OldOrderId}`);
        continue;
      }

      // 📦 Product
      const product = await getProduct(i.ProductId);
      if (!product) {
        console.warn(`⚠️ Product not found: ${i.ProductId}`);
        continue;
      }

      const unitPrice = Number(
        (i.LineTotal / i.Quantity).toFixed(2)
      );

      // 1️⃣ Create OrderItem (NO order relation)
      const orderItemRes = await axios.post(
        `${STRAPI_URL}/api/order-items`,
        {
          data: {
            quantity: i.Quantity,
            productQuantity: i.Quantity,
            unitPrice,
            lineTotal: i.LineTotal,
            productVat: i.ProductVAT,
            productId: i.ProductId.toString(),
            productName: product.title,
          },
        },
        { headers: HEADERS }
      );

      const orderItemId = orderItemRes.data.data.id;

      // 2️⃣ Attach OrderItem to Order
      const existingItems =
        order.orderItems?.data?.map((x) => x.id) || [];

      await axios.put(
        `${STRAPI_URL}/api/orders/${order.documentId}`,
        {
          data: {
            orderItems: [...existingItems, orderItemId],
          },
        },
        { headers: HEADERS }
      );

      console.log(
        `✅ Item linked | Order ${i.OldOrderId} | ${product.title}`
      );
    } catch (err) {
      console.error(
        `❌ Failed item for order ${i.OldOrderId}`,
        err.response?.data || err.message
      );
    }
  }
}

migrateOrderItems();