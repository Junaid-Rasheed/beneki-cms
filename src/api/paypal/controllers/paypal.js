const fetch = require("node-fetch");

const PAYPAL_API = "https://api-m.sandbox.paypal.com";
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const UiUrl = process.env.FRONTEND_URL;
async function getAccessToken() {
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(PAYPAL_CLIENT_ID + ":" + PAYPAL_SECRET).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  return data.access_token;
}

module.exports = {
  async createOrder(ctx) {
  const { amount } = ctx.request.body;

  if (!amount) {
    return ctx.badRequest("Amount is required");
  }

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
            value: amount.toString(), // convert to string as required by PayPal
          },
        },
      ],
    }),
  });

  const data = await response.json();
  const approvalUrl = data.links.find((link) => link.rel === "approve")?.href;

  return { id: data.id, approvalUrl };
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