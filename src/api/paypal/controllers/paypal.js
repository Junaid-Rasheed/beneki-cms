const fetch = require("node-fetch");

const PAYPAL_API = "https://api-m.sandbox.paypal.com";
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const UiUrl = process.env.FRONTEND_URL;
async function getAccessToken() {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Failed to get PayPal token:", data);
    throw new Error("PayPal token fetch failed");
  }

  return data.access_token;
}

module.exports = {
  async createOrder(ctx) {
    const { amount } = ctx.request.body;

    if (!amount) {
      return ctx.badRequest("Amount is required");
    }

    try {
      const accessToken = await getAccessToken();

      const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          application_context: {
            return_url: `${UiUrl}/paypalpayment-success`,
            cancel_url: `${UiUrl}/paypalpayment-cancel`,
          },
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: amount.toString(),
              },
            },
          ],
        }),
      });

      const data = await response.json();
      console.log("PayPal order create response:", data); // ADD THIS

      if (!response.ok) {
        console.error("PayPal order creation failed:", data);
        return ctx.internalServerError("Failed to create PayPal order");
      }

      const approvalUrl = data.links?.find((link) => link.rel === "approve")?.href;

      if (!approvalUrl) {
        console.error("Approval URL not found in PayPal response");
        return ctx.internalServerError("Approval URL not found");
      }

      return { id: data.id, approvalUrl };

    } catch (err) {
      console.error("PayPal createOrder error:", err);
      return ctx.internalServerError("PayPal order creation failed");
    }
  },

  async captureOrder(ctx) {
    const { token } = ctx.query; // PayPal will send this on return URL
    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${token}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return data;
  },
};