'use strict';

const iconv = require('iconv-lite');
const crypto = require('crypto');
const fetch = require("node-fetch");

function createRequestMac({ PayID = "", TransID, MerchantID, Amount, Currency, hmacKey }) {
  const baseString = [PayID, TransID, MerchantID, Amount, Currency].join("*");
  const hmac = crypto.createHmac("sha256", hmacKey);
  hmac.update(baseString);
  return hmac.digest("hex").toUpperCase();
}
//const { Blowfish } = await import("egoroof-blowfish"); 
//https://paymentpage.axepta.bnpparibas/PayNow.aspx
module.exports = {
   
  // async createPayment(ctx) {
  //   try {
  //     const { cardNumber, expiry, cvv, name, amount, currency, orderId } = ctx.request.body;
  //     const { Blowfish } = await import("egoroof-blowfish");  
  //     const merchantId = process.env.BNP_MERCHANT_ID;
  //     const blowfishKey = process.env.BNP_BLOWFISH_KEY;
  //     const hmacKey = process.env.BNP_HMAC_KEY;

  //     // 1️⃣ Encrypt card fields
  //     const bf = new Blowfish(blowfishKey, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);
  //     const encCard = Buffer.from(bf.encode(cardNumber, Blowfish.TYPE.STRING)).toString("base64");
  //     const encExpiry = Buffer.from(bf.encode(expiry, Blowfish.TYPE.STRING)).toString("base64");
  //     const encCvv = Buffer.from(bf.encode(cvv, Blowfish.TYPE.STRING)).toString("base64");

  //     // 2️⃣ Build payload (fields per BNP doc)
  //     const payload = {
  //       MerchantID: merchantId,
  //       OrderID: orderId,
  //       Amount: amount,
  //       Currency: currency,
  //       PAN: encCard,
  //       Expiry: encExpiry,
  //       CVV: encCvv,
  //       CardHolderName: name,
  //     };

  //     // 3️⃣ HMAC signature (order-sensitive: check BNP doc for exact order!)
  //     const payloadString = `${merchantId}${orderId}${amount}${currency}`;
  //     const signature = crypto.createHmac("sha256", hmacKey).update(payloadString).digest("hex");

  //     // 4️⃣ Send Silent POST
  //     const formData = new URLSearchParams({ ...payload, Signature: signature });

  //     const response = await fetch("https://paymentpage.axepta.bnpparibas/PayNow.aspx", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/x-www-form-urlencoded" },
  //       body: formData,
  //     });

  //     const text = await response.text(); // BNP usually responds with HTML/XML
  //     return ctx.send({ success: true, raw: text });
  //   } catch (err) {
  //     console.error("BNP Payment Error:", err);
  //     return ctx.internalServerError("Payment Failed ❌: " + err.message);
  //   }
  // },
  // async createPayment(ctx) {
  //   const { cardNumber, expiryDate, cvv, cardholderName, amount, currency, orderId } =
  //     ctx.request.body;

  //   // Config from .env
  //   const merchantId = process.env.BNP_MERCHANT_ID;
  //   const blowfishKey = process.env.BNP_BLOWFISH_KEY;
  //   const hmacKey = process.env.BNP_HMAC_KEY;

  //   // BNP requires expiry in YYYYMM format
  //   // assume you pass expiryDate already in YYYYMM (e.g. "202509")
  //   // otherwise convert MM/YY → YYYYMM

  //   // 1. Encrypt card data with Blowfish
  //   const { Blowfish } = await import("egoroof-blowfish"); 
  //   const bf = new Blowfish(blowfishKey, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);

  //   const encCard = Buffer.from(
  //     bf.encode(cardNumber, Blowfish.TYPE.STRING)
  //   ).toString("base64");
  //   const encExpiry = Buffer.from(
  //     bf.encode(expiryDate, Blowfish.TYPE.STRING)
  //   ).toString("base64");
  //   const encCvv = Buffer.from(
  //     bf.encode(cvv, Blowfish.TYPE.STRING)
  //   ).toString("base64");

  //   // 2. Build request payload according to BNP SOP spec
  //   const payload = {
  //     MerchantID: merchantId,
  //     TransID: orderId, // unique per transaction
  //     MsgVer: "2.0",
  //     RefNr: orderId.slice(0, 12).padStart(12, "0"), // BNP requires fixed 12 chars
  //     Amount: amount, // in cents (e.g. "100" = 1.00 EUR)
  //     Currency: currency, // e.g. "EUR"
  //     OrderDesc: "Test Order from Strapi",
  //     URLSuccess: "http://localhost:5173/bnp-payment-success",
  //     URLFailure: "http://localhost:5173/bnp-payment-failed",
  //     URLNotify: "http://localhost:5173/bnp-payment-success",
  //     CardNo: encCard,
  //     Expiry: encExpiry,
  //     Cvv2: encCvv,
  //     CreditCardHolder: cardholderName,
  //   };

  //   // 3. Generate HMAC (MAC)
  //   // ⚠️ BNP requires MAC on the concatenation of specific fields (order matters!)
  //   // According to docs: MerchantID + TransID + RefNr + Amount + Currency
  //   const macSource = `${payload.MerchantID}${payload.TransID}${payload.RefNr}${payload.Amount}${payload.Currency}`;
  //   const mac = crypto.createHmac("sha256", hmacKey).update(macSource).digest("hex");
  //   payload.MAC = mac;

  //   try {
  //     // 4. Send as application/x-www-form-urlencoded
  //     const res = await fetch("https://paymentpage.axepta.bnpparibas/PayNow.aspx", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/x-www-form-urlencoded" },
  //       body: new URLSearchParams(payload),
  //     });

  //     const raw = await res.text(); // BNP responds with querystring
  //     const parsed = Object.fromEntries(new URLSearchParams(raw));

  //     return ctx.send({
  //       success: parsed.Status === "APPROVED" && parsed.code === "00000000",
  //       raw,
  //       parsed,
  //     });
  //   } catch (err) {
  //     return ctx.send({ success: false, message: err.message });
  //   }
  // },
  // async createPayment(ctx) {
  //   const { cardNumber, expiryDate, cvv, cardholder, amount, currency, orderId } =
  //     ctx.request.body;

  //   // 🔑 Config from env
  //   const merchantId = process.env.BNP_MERCHANT_ID;
  //   const blowfishKey = process.env.BNP_BLOWFISH_KEY;
  //   const hmacKey = process.env.BNP_HMAC_KEY;

  //   // 🔒 Blowfish encrypt sensitive fields
  //   const { Blowfish } = await import("egoroof-blowfish"); 

  //   const bf = new Blowfish(blowfishKey, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);

  //   const encCard = Buffer.from(bf.encode(String(cardNumber))).toString("base64");
  //   const encExpiry = Buffer.from(bf.encode(String(expiryDate))).toString("base64");
  //   const encCvv = Buffer.from(bf.encode(String(cvv))).toString("base64");
  //   // 🔑 BNP requires specific form fields
  //   const payload = {
  //     MerchantID: merchantId,
  //     TransID: orderId,
  //     RefNr: orderId.padStart(12, "0"), // must be fixed length 12 chars
  //     MsgVer: "2.0",
  //     Amount: String(amount), // in cents (e.g. "100" = 1.00 EUR)
  //     Currency: currency, // e.g. "EUR"
  //     OrderDesc: "Test Payment",

  //     // Card data (encrypted)
  //     Data: encCard, // Blowfish encrypted card number
  //     Len: encCard.length,
  //     number: encCard,
  //     expiryDate: encExpiry,
  //     securityCode: encCvv,
  //     cardholder,

  //     // Callback URLs
  //     URLSuccess: "http://localhost:5173/bnp-payment-success",
  //     URLFailure: "http://localhost:5173/bnp-payment-failed",
  //     URLNotify: "http://localhost:5173/bnp-payment-success",
  //   };

  //   // 🔏 Generate MAC (order matters!)
  //   // According to BNP docs: MerchantID + TransID + Amount + Currency
  //   const macString = payload.MerchantID + payload.TransID + payload.Amount + payload.Currency;
  //   payload.MAC = crypto
  //     .createHmac("sha256", hmacKey)
  //     .update(macString)
  //     .digest("hex");

  //   try {
  //     // 🔄 Submit via x-www-form-urlencoded
  //     const res = await fetch(
  //       "https://paymentpage.axepta.bnpparibas/PayNow.aspx",
  //       {
  //         method: "POST",
  //         headers: { "Content-Type": "application/x-www-form-urlencoded" },
  //         body: new URLSearchParams(payload),
  //       }
  //     );

  //     const raw = await res.text(); // BNP returns querystring
  //     const parsed = Object.fromEntries(new URLSearchParams(raw));

  //     return ctx.send({
  //       success: parsed.Status === "APPROVED" || parsed.code === "00000000",
  //       raw,
  //       parsed,
  //     });
  //   } catch (err) {
  //     return ctx.send({ success: false, message: err.message });
  //   }
  // },

  // async createSession(ctx) {
  //   try {
  //     const { amount, currency, orderId } = ctx.request.body;
  //     const { Blowfish } = await import("egoroof-blowfish");

  //     const merchantId = process.env.BNP_MERCHANT_ID;
  //     const blowfishKey = process.env.BNP_BLOWFISH_KEY;
  //     const hmacKey = process.env.BNP_HMAC_KEY;

  //     // --- 1. Build payload ---
  //     const payload = {
  //       MerchantID: merchantId,
  //       TransID: orderId,
  //       RefNr: orderId.padStart(12, "0"),
  //       Amount: amount,
  //       Currency: currency,
  //       MsgVer: "2.0",
  //       URLSuccess: "http://localhost:5173/bnp-payment-success",
  //       URLFailure: "http://localhost:5173/bnp-payment-failed",
  //       URLNotify: "http://localhost:1337/api/bnpaxepta/notify",
  //     };
  //     const payloadString = Object.entries(payload)
  //       .map(([k, v]) => `${k}=${v}`)
  //       .join("&");

  //     // --- 2. Blowfish encrypt ---
  //     const bf = new Blowfish(
  //       blowfishKey,
  //       Blowfish.MODE.ECB,
  //       Blowfish.PADDING.PKCS5
  //     );
  //     const encrypted = bf.encode(payloadString, Blowfish.TYPE.UINT8_ARRAY);

  //     // --- 3. Format Data (toggle HEX / Base64 here) ---
  //     const useBase64 = false; // change to false to test HEX
  //     let dataString;
  //     let len;

  //     if (useBase64) {
  //       dataString = Buffer.from(encrypted).toString("base64");
  //       len = Buffer.from(encrypted).length; // byte length
  //     } else {
  //       dataString = Buffer.from(encrypted).toString("hex").toUpperCase();
  //       len = dataString.length; // char length
  //     }

  //     // --- 4. HMAC SHA-256 on Data ---
  //     const mac = crypto
  //       .createHmac("sha256", hmacKey)
  //       .update(dataString)
  //       .digest("hex")
  //       .toUpperCase();

  //     // --- 5. Return session params ---
  //     ctx.send({
  //       MerchantID: merchantId,
  //       Len: len,
  //       Data: dataString,
  //       MAC: mac,
  //     });
  //   } catch (err) {
  //     console.error("Error in createSession:", err);
  //     ctx.throw(500, "Failed to create session");
  //   }
  // },

  async createSession(ctx) {
  const { amount, currency, orderId } = ctx.request.body;
  const { Blowfish } = await import("egoroof-blowfish");
  
  const merchantId = process.env.BNP_MERCHANT_ID;
  const blowfishKey = process.env.BNP_BLOWFISH_KEY;
  const hmacKey = process.env.BNP_HMAC_KEY;

  // Use smallest currency unit
  const amountMinor = Math.round(amount * 100);

  // Build payload string in exact required order
  const payloadString =
    `MerchantID=${merchantId}` +
    `&TransID=${orderId}` +
    `&RefNr=${orderId.padStart(12, "0")}` +
    `&Amount=${amountMinor}` +
    `&Currency=${currency}` +
    `&MsgVer=2.0` +
    `&URLSuccess=${process.env.URL_SUCCESS}` +
    `&URLFailure=${process.env.URL_FAILURE}` +
    `&URLNotify=${process.env.URL_NOTIFY}`;

  // Encrypt using Blowfish (ECB, PKCS5), then convert to HEX uppercase
  const bf = new Blowfish(blowfishKey, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);
  const encrypted = bf.encode(payloadString, Blowfish.TYPE.UINT8_ARRAY);
  const dataString = Buffer.from(encrypted).toString("hex").toUpperCase();

  // Len is the byte length of encrypted data
  const len = Buffer.from(encrypted).length;

  // MAC: HMAC SHA-256 over Data (hex string)
  const mac = crypto.createHmac("sha256", hmacKey)
    .update(dataString, "utf8")
    .digest("hex")
    .toUpperCase();

  return {
    MerchantID: merchantId,
    Len: len,
    Data: dataString,
    MAC: mac
  };
},

  async notify(ctx) {
    console.log("BNP Notify:", ctx.request.body || ctx.query);
    ctx.send({ status: "ok" });
  },
};