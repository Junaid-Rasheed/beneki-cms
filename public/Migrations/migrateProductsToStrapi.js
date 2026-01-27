const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");

// ================= CONFIG =================
const STRAPI_URL = "https://beneki-cms.onrender.com";
const API_TOKEN =
  "22fdb22e38a7454177127b48eb44bf999be712727cbe61de11e63f2b97f67d950981ccc3ee8118c776b09ce36f44f6f58d78973e62cb9a124e34aef10a2c7d08ca54f02e829b5da87a01bbe23e71c3746beed077bd50ca516cec7ad7b72137dccc98c432d68fc27973d4b25502fa4c39fd4036dd325bbd132264c336c4ee63b4";

const CSV_FILE = "products.csv";
const products = [];

// Axios headers
const headers = {
  Authorization: `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json",
};

// ================= LOAD CSV =================
fs.createReadStream(CSV_FILE)
  .pipe(csv({ separator: "," }))
  .on("data", (row) => products.push(row))
  .on("end", async () => {
    console.log(`📦 Loaded ${products.length} products from CSV`);
    await migrate();
  });

// ================= MIGRATION =================
async function migrate() {
  for (const oldProduct of products) {
    try {
      // 1️⃣ Skip if ProductOldId is missing
      if (!oldProduct.ProductOldId) {
        console.log("⏭ Skipped row (no ProductOldId)");
        continue;
      }

      // 2️⃣ Check if already exists
      const exists = await axios.get(`${STRAPI_URL}/api/products`, {
        headers,
        params: {
          "filters[ProductOldId][$eq]": oldProduct.ProductOldId,
        },
      });

      if (exists.data.data.length > 0) {
        console.log(
          `⏭ Skipped (exists): ${oldProduct.title} [OldID=${oldProduct.ProductOldId}]`
        );
        continue;
      }

      // 3️⃣ Map CSV → Strapi fields
      const mappedData = {
        title: oldProduct.title,
        slug: oldProduct.slug,
        Url: oldProduct.Url,
        order: Number(oldProduct.order) || 0,
        isActive: true,

        PD_Description: oldProduct.PD_Description,
        PD_Description2: oldProduct.PD_Description2,

        quantity: oldProduct.quantity || "0",
        VAT: Number(oldProduct.VAT) || 0,
        weight: Number(oldProduct.weight) || 0,
        numberOfBoxes: Number(oldProduct.numberOfBoxes) || 0,

        isHomeProduct: false,

        // IDs
        ProductOldId: oldProduct.ProductOldId,
        productId: oldProduct.productId || oldProduct.ProductOldId,
        productTitle: oldProduct.productTitle || oldProduct.title,
      };

      // 4️⃣ Create product
      await axios.post(
        `${STRAPI_URL}/api/products`,
        { data: mappedData },
        { headers }
      );

      console.log(`✅ Imported: ${mappedData.title}`);
    } catch (error) {
      console.error(
        `❌ Failed: ${oldProduct.title}`,
        JSON.stringify(error.response?.data || error.message, null, 2)
      );
    }
  }

  console.log("🎉 Product CSV migration completed");
}