const fs = require("fs");
const axios = require("axios");

// ================= CONFIG =================
const STRAPI_URL = "https://beneki-cms.onrender.com";
const API_TOKEN = "44cf8e468dbd881753e790053af228690393e64654188211f0e94f6f5d0ddf068fb9db0e3f0cd4c0967a3cd07fb66388cc05744647fc31c4104fb5820a5e9871170419bac4e301448464c33578a7d8e92115d15c192017e34fc9f3423e6bf639695ca71f42e6679a064756343f1ed3df7b45a963e7efb78931ad9f9dc93e7572";

const HEADERS = {
  //Authorization: `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json",
};

// ================= LOAD DATA =================
const raw = JSON.parse(fs.readFileSync("OrderAddresses.fixed.json", "utf8"));
const addresses = raw.data;

// ================= MIGRATION =================
async function migrateAddresses() {
  for (const addr of addresses) {
    try {
      // 1️⃣ Find the order by oldOrderId
      const orderRes = await axios.get(
        `${STRAPI_URL}/api/orders?filters[oldOrderId][$eq]=${addr.order_id}`,
        { headers: HEADERS }
      );
      
      const order = orderRes.data?.data?.[0];
      if (!order) {
        console.warn(`⚠️ Order not found for OldOrderId: ${addr.order_id}`);
        continue;
      }

      // 2️⃣ Prepare payload for OrderAddress
      const payload = {
        data: {
          firstName: addr.first_name,
          lastName: addr.last_name,
          companyName: addr.company || "",
          country: addr.country,
          street: addr.address_1,
          appartment: addr.address_2 || "",
          postalCode: addr.postcode || "",
          city: addr.city || "",
          phoneNumber: addr.phone || "",
          email: addr.email || "",
        },
      };

      // 3️⃣ Create address in Strapi
      const addressRes = await axios.post(
        `${STRAPI_URL}/api/order-addresses`,
        payload,
        { headers: HEADERS }
      );

      const addressId = addressRes.data?.data?.id;
      if (!addressId) {
        console.error(`❌ Failed to create address for order ${addr.order_id}`);
        continue;
      }

      // 4️⃣ Link to order (billing or shipping)
      const orderUpdatePayload = {
        data: {},
      };

      if (addr.address_type?.toLowerCase() === "billing") {
        orderUpdatePayload.data.billingAddress = addressId;
      } else if (addr.address_type?.toLowerCase() === "shipping") {
        orderUpdatePayload.data.shippingAddress = addressId;
      } else {
        console.warn(`⚠️ Unknown address type for order ${addr.order_id}: ${addr.address_type}`);
        continue;
      }
      await axios.put(
        `${STRAPI_URL}/api/orders/${order.documentId}`,
        orderUpdatePayload,
        { headers: HEADERS }
      );

      console.log(
        `✅ Linked ${addr.address_type} address for order ${addr.order_id}`
      );
    } catch (err) {
      console.error(
        `❌ Error migrating address for order ${addr.order_id}`,
        err.response?.data || err.message
      );
    }
  }
}

migrateAddresses();