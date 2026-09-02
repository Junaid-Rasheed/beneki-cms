'use strict';

function applyPlaceholders(text, vars = {}) {
  if (!text) return '';
  return Object.entries(vars).reduce(
    (out, [key, value]) =>
      out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? ''),
    String(text)
  );
}

async function findLogisticEmailTemplate(strapi, locale = 'en') {
  const normalizedLocale = String(locale || 'en').split('-')[0] || 'en';

  const baseWhere = {
    module: 'logistic',
    publishedAt: { $notNull: true },
  };

  let template = await strapi.db
    .query('api::email-template.email-template')
    .findOne({
      where: { ...baseWhere, locale: normalizedLocale },
    });

  if (!template && normalizedLocale !== 'en') {
    template = await strapi.db
      .query('api::email-template.email-template')
      .findOne({
        where: { ...baseWhere, locale: 'en' },
      });
  }

  return template;
}

/**
 * Send logistics notification using EmailTemplate where module = logistic.
 * Placeholders: {{name}}, {{labelCount}}, {{time}}
 */
async function sendLogisticNotifyEmail(
  strapi,
  { to, name, labelCount, time, locale = 'en' }
) {
  if (!to) return false;

  const template = await findLogisticEmailTemplate(strapi, locale);

  if (!template) {
    strapi.log.warn(
      `[logistic] No EmailTemplate found (module=logistic, locale=${locale})`
    );
    return false;
  }

  const vars = {
    name: name || '',
    labelCount: String(labelCount),
    time: time || '',
  };

  const subject =
    applyPlaceholders(template.subject, vars) ||
    `Labels printed: ${vars.labelCount}`;
  const message = applyPlaceholders(template.message, vars);
  const closingText = applyPlaceholders(template.closingText, vars);

  const messageLooksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(message || '');
  const messageHtml = messageLooksLikeHtml
    ? message || ''
    : `<p>${message || ''}</p>`;

  await strapi.plugin('email').service('email').send({
    to,
    subject,
    html: `
      ${messageHtml}
      ${closingText ? `<p style="margin-top:30px;">${closingText}</p>` : ''}
    `,
  });

  return true;
}

module.exports = {
  findLogisticEmailTemplate,
  sendLogisticNotifyEmail,
};
