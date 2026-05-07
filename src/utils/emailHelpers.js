async function sendFailedPaymentEmail(strapi, email, template, order) {
  if (!template || !email) return;

  const subject = template.subject;

  let message = template.message
    .replace("{{orderId}}", order.orderNumber)
    .replace("{{name}}", order.customerName || "Customer");

  const buttonText = template.buttonText || "View Order";
  const closingText = template.closingText || "";

  await strapi.plugin("email").service("email").send({
    to: email,
    subject,
    html: `
      <p>${message}</p>
      <br/>
      <a href="${template.buttonUrl}/${order.orderNumber}">
        ${buttonText}
      </a>
      <br/><br/>
      <p>${closingText}</p>
    `,
  });
}

async function getEmailTemplate(strapi, locale) {
  return await strapi.db
    .query("api::email-template.email-template")
    .findOne({
      where: {
        module: "failedPayment",
        locale: locale,
      },
    });
}

function getLocaleFromOrder(order) {
  const country =
    order?.deliveryAddress?.country ||
    order?.billingAddress?.country ||
    "en";

  return country.toLowerCase();
}

module.exports = {
  sendFailedPaymentEmail,
  getEmailTemplate,
  getLocaleFromOrder,
};