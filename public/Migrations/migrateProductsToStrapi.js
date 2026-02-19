const fs = require("fs");
const axios = require("axios");

// ================= CONFIG =================
const STRAPI_URL = "https://beneki-cms.onrender.com";
const API_TOKEN  =
  "44cf8e468dbd881753e790053af228690393e64654188211f0e94f6f5d0ddf068fb9db0e3f0cd4c0967a3cd07fb66388cc05744647fc31c4104fb5820a5e9871170419bac4e301448464c33578a7d8e92115d15c192017e34fc9f3423e6bf639695ca71f42e6679a064756343f1ed3df7b45a963e7efb78931ad9f9dc93e7572";


// Load cleaned JSON
const raw = JSON.parse(fs.readFileSync("products.fixed.json", "utf8"));
const products = raw.data; 
// Map products
const mappedProducts = products.map((p) => ({
  title: p.title,
  isActive: false,
  productId: p.ProductOldId,
  productOldId: p.ProductOldId,
  productTitle: p.productTitle
}));


async function migrateProducts() {
  for (const p of products) {
    try {
      const res = await axios.post(
        `${STRAPI_URL}/api/sidebar-items`,
        {
          data: {
            title: p.title,
            isActive: false,
            productId: p.ProductOldId,
            productOldId: p.ProductOldId,
            productTitle: p.productTitle,
            isHomeProduct: false,
          },
        },
        {
          headers: {
            //Authorization: `Bearer ${API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`✅ Created: ${p.title},${p.ProductOldId}`);
    } catch (err) {
      console.error(`❌ Failed: ${p.title}`, err.response?.data || err.message);
    }
  }
}

migrateProducts();