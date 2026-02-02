const fs = require("fs");

//let raw = fs.readFileSync("products.json", "utf8");
let raw = fs.readFileSync("orders.json", "utf8");
//let raw = fs.readFileSync("OrderAddresses.json", "utf8");

// 1️⃣ Remove BOM if present
raw = raw.replace(/^\uFEFF/, "");

// 2️⃣ Escape ALL backslashes that are not already escaped
raw = raw.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

// 3️⃣ Replace raw newlines INSIDE strings
raw = raw.replace(/:\s*"([\s\S]*?)"/g, (match, value) => {
  const safe = value
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ");
  return `:"${safe}"`;
});

// 4️⃣ Normalize remaining line breaks
raw = raw.replace(/\r?\n/g, "");

// 5️⃣ Final safety: remove non-printable ASCII
raw = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

//fs.writeFileSync("products.fixed.json", raw, "utf8");
fs.writeFileSync("orders.fixed.json", raw, "utf8");
//fs.writeFileSync("OrderAddresses.fixed.json", raw, "utf8");

console.log("✅ JSON sanitized → products.fixed.json");