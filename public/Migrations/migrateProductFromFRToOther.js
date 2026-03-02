const axios = require("axios");

// ================= CONFIG =================
const STRAPI_URL = "https://beneki-cms.onrender.com";
const API_TOKEN = "YOUR_API_TOKEN";

const CONTENT_TYPE = "sidebar-items";
const SOURCE_LOCALE = "fr";
const TARGET_LOCALE = "it";
// ==========================================

const api = axios.create({
  baseURL: STRAPI_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

async function getProducts(page = 1) {
  const res = await api.get(`/api/${CONTENT_TYPE}`, {
    params: {
      locale: SOURCE_LOCALE,
      "filters[isActive][$eq]": true,
      populate: "*",
      pagination: { page, pageSize: 100 },
    },
  });

  return res.data;
}

function hasEnglishLocalization(product) {
  const localizations =
    product.localizations?.data ||
    product.attributes?.localizations?.data ||
    [];

  return localizations.some((loc) => {
    return (
      loc.locale === TARGET_LOCALE ||
      loc.attributes?.locale === TARGET_LOCALE
    );
  });
}

function extractMediaId(mediaField) {
  if (!mediaField) return null;

  // Single media object
  if (!Array.isArray(mediaField) && mediaField.id) return mediaField.id;

  // Array of media
  if (Array.isArray(mediaField)) return mediaField.map((m) => m.id);

  return null;
}

function extractRelationIds(field) {
  if (!field) return null;
  if (!Array.isArray(field)) return field.id || null;
  return field.map((f) => f.id);
}

function cleanProductData(product) {
  const attributes = product;

  const cleaned = {
    title: attributes.title,
    slug: attributes.slug ? attributes.slug + "-it" : null,
    Url: attributes.Url,
    order: attributes.order,
    isActive: attributes.isActive,
    PD_Description: attributes.PD_Description,
    PD_PriceRange: attributes.PD_PriceRange,
    quantity: attributes.quantity,
    PD_Description2: attributes.PD_Description2,
    isHomeProduct: attributes.isHomeProduct,
    VAT: attributes.VAT,
    weight: attributes.weight,
    numberOfBoxes: attributes.numberOfBoxes,
    productId: attributes.productId,
    productTitle: attributes.productTitle,
    productOldId: attributes.productOldId,
    PD_Point: attributes.PD_Point,
    isSideBarProduct: attributes.isSideBarProduct,
    isCollection: attributes.isCollection,
    collection_Category_Title: attributes.collection_Category_Title,
    isAdminProduct: attributes.isAdminProduct,

    // ✅ Media
    icon: extractMediaId(attributes.icon),
    PD_Gallery: extractMediaId(attributes.PD_Gallery),

    // ✅ Relations we want to keep
    coupons: extractRelationIds(attributes.coupons),
    productCoupons: extractRelationIds(attributes.productCoupons),
  };

  // Remove null/undefined values
  Object.keys(cleaned).forEach((key) => cleaned[key] == null && delete cleaned[key]);

  return cleaned;
}

async function createProductLocalization(product) {
    //console.log("product", product)
  const cleaned = cleanProductData(product);
    //console.log("cleaned",cleaned)
  await api.post(`/api/${CONTENT_TYPE}?locale=pt`, {
    data: {
      ...cleaned,
      //locale: TARGET_LOCALE,
    },
  });
}

async function migrate() {
  let page = 1;
  let totalPages = 1;

  console.log("🚀 Starting FR → EN duplication");

  do {
    const response = await getProducts(page);
    const products = response.data;
    totalPages = response.meta.pagination.pageCount;

    for (const product of products) {
      if (hasEnglishLocalization(product)) {
        console.log(`⏩ Skipping ${product.id}`);
        continue;
      }

      console.log(`➕ Creating EN for ${product.id}`);
      await createProductLocalization(product);
      console.log(`✅ Done ${product.id}`);
    }

    page++;
  } while (page <= totalPages);

  console.log("🎉 Migration completed");
}

migrate().catch((err) => {
  console.error("❌ Error:", err.response?.data || err.message);
});