const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");
//cd .\public\Migrations
//node migrateCsvToStrapi.js
const STRAPI_URL = "https://beneki-cms.onrender.com"; // no /api at end
const API_TOKEN = "b3ebbbcfd61afc1ac870cca47c8907292aa0834078d47faed8eb28da046667aac19abeb7ec9fb836494721ce7e50dc67578076e295a58e0a8de70451741e731259987e1d505fbca0df9089beb9347f99cdb1c274900c7e7956538ff9239a9b4072ef707ec9cac18f1907ed8726fdea84b30bbd59cb3ca41066db2d5b1fdbd61b";

const records = [];

// Load CSV
fs.createReadStream("oldData.csv")
  .pipe(csv({ separator: ";" }))
  .on("data", (row) => records.push(row))
  .on("end", async () => {
    console.log(`📄 Loaded ${records.length} records from CSV`);
    await migrateToStrapi();
  });

async function migrateToStrapi() {
  for (const oldItem of records) {
    const mappedData = {
      username: oldItem.user_login,
      email: oldItem.user_email,
      password: "Demo@123", // temporary password
    };

    try {
      // Register user
      const res = await axios.post(
        `${STRAPI_URL}/api/auth/local/register`,
        mappedData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`✅ Registered: ${mappedData.username}`);

      // Optional: update extra fields (if your User model supports them)
      await axios.put(
        `${STRAPI_URL}/api/users/${res.data.user.id}`,
        {
          displayName: oldItem.display_name,
          accountType: "Individual",
          businessRegistrationCountry: "France",
          confirmed: true,
          blocked: false,
        },
        {
          headers: {
            //Authorization: `Bearer ${API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(`🔄 Updated extra fields for: ${mappedData.username}`);
    } catch (error) {
      console.error(`❌ Failed for: ${mappedData.username}`);
      console.error(
        JSON.stringify(error.response?.data || error.message, null, 2)
      );
    }
  }
}