'use strict';

/**
 * Lookup email-template by module + locale, with EN fallback.
 */
async function findEmailTemplate(strapi, module, locale) {
  const normalizedLocale = String(locale || 'en').split('-')[0] || 'en';

  let template = await strapi.db
    .query('api::email-template.email-template')
    .findOne({
      where: { module, locale: normalizedLocale },
    });

  if (!template && normalizedLocale !== 'en') {
    template = await strapi.db
      .query('api::email-template.email-template')
      .findOne({
        where: { module, locale: 'en' },
      });
  }

  return template;
}

function applyPlaceholders(text, vars = {}) {
  if (!text) return '';
  return Object.entries(vars).reduce(
    (out, [key, value]) =>
      out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? ''),
    String(text)
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function templateMentionsNote(template) {
  const haystack = [
    template?.subject,
    template?.message,
    template?.closingText,
  ]
    .filter(Boolean)
    .join('\n');
  return /\{\{\s*(note|requestedInfo)\s*\}\}/.test(haystack);
}

function buildNoteHtml(note) {
  const text = String(note || '').trim();
  if (!text) return '';
  return `<p style="white-space:pre-wrap;margin-top:16px;">${escapeHtml(text)}</p>`;
}

async function sendTemplatedEmail(
  strapi,
  { to, module, locale, vars, fallbackSubject, appendNoteHtml = '' }
) {
  if (!to) return false;

  const normalizedLocale = String(locale || 'en').split('-')[0] || 'en';
  const template = await findEmailTemplate(strapi, module, normalizedLocale);

  if (!template) {
    strapi.log.warn(
      `[account-review-email] No email-template (module=${module}) for locale=${normalizedLocale} (or en)`
    );
    return false;
  }

  const subject =
    applyPlaceholders(template.subject, vars) || fallbackSubject || module;
  const message = applyPlaceholders(template.message, vars);
  const closingText = applyPlaceholders(template.closingText, vars);

  // CMS message may already be full HTML (<p>…</p>); don't wrap again.
  const messageLooksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(message || '');
  const messageHtml = messageLooksLikeHtml
    ? message || ''
    : `<p>${message || ''}</p>`;

  await strapi.plugin('email').service('email').send({
    to,
    subject,
    html: `
      ${messageHtml}
      ${appendNoteHtml || ''}
      ${closingText ? `<p style="margin-top:30px;">${closingText}</p>` : ''}
    `,
  });

  return true;
}

/**
 * Send localized registration confirmation email via email-template
 * (module = registrationtemplate), with EN fallback.
 */
async function sendRegistrationConfirmationEmail(strapi, { email, locale }) {
  if (!email) return;

  await sendTemplatedEmail(strapi, {
    to: email,
    module: 'registrationtemplate',
    locale,
    vars: {},
    fallbackSubject: 'Registration received',
  });
}

/**
 * Users-permissions users whose role name is Admin.
 */
async function findAdminUsers(strapi) {
  const adminRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { name: 'Admin' } });

  if (!adminRole) {
    strapi.log.warn(
      '[registration-admin-notify] No users-permissions role named "Admin"'
    );
    return [];
  }

  return strapi.db.query('plugin::users-permissions.user').findMany({
    where: {
      role: adminRole.id,
      blocked: false,
    },
  });
}

/**
 * Notify all Admin-role users that a registration is pending review.
 * Template module: registrationadminnotify (EN fallback).
 *
 * Supported placeholders: {{email}}, {{userId}}, {{username}}, {{accountStatus}}
 */
async function sendRegistrationAdminNotifyEmail(
  strapi,
  { applicant, locale = 'en' }
) {
  if (!applicant?.email) return;

  const admins = await findAdminUsers(strapi);
  const adminEmails = [
    ...new Set(
      admins.map((u) => u.email).filter((e) => e && e !== applicant.email)
    ),
  ];

  if (!adminEmails.length) {
    strapi.log.warn(
      '[registration-admin-notify] No Admin users with email to notify'
    );
    return;
  }

  const template = await findEmailTemplate(
    strapi,
    'registrationadminnotify',
    locale
  );

  if (!template) {
    strapi.log.warn(
      '[registration-admin-notify] No email-template (module=registrationadminnotify)'
    );
    return;
  }

  const vars = {
    email: applicant.email || '',
    userId: String(applicant.id ?? ''),
    username: applicant.username || applicant.email || '',
    accountStatus: applicant.accountStatus || 'pending_review',
  };

  const subject =
    applyPlaceholders(template.subject, vars) ||
    'New registration pending review';
  const message = applyPlaceholders(template.message, vars);
  const closingText = applyPlaceholders(template.closingText, vars);

  const html = `
    <p>${message || `A new user registered and is awaiting review: ${vars.email}`}</p>
    ${closingText ? `<p style="margin-top:30px;">${closingText}</p>` : ''}
  `;

  await Promise.all(
    adminEmails.map((to) =>
      strapi.plugin('email').service('email').send({ to, subject, html })
    )
  );
}

/**
 * Account review decision emails.
 * Modules: accountapproved | accountmoreinfo | accountrefused
 * Placeholders: {{email}}, {{userId}}, {{username}}, {{businessName}},
 *   {{accountStatus}}, {{note}}, {{requestedInfo}}
 *
 * For request_more_info, the admin `note` is always included in the body:
 * - via {{note}} / {{requestedInfo}} if present in the CMS template, or
 * - appended after the message when those placeholders are missing.
 */
async function sendAccountReviewDecisionEmail(
  strapi,
  { user, action, locale = 'en', note = '' }
) {
  const moduleByAction = {
    approve: 'accountapproved',
    request_more_info: 'accountmoreinfo',
    refuse: 'accountrefused',
  };

  const module = moduleByAction[action];
  if (!module || !user?.email) return false;

  const requestedInfo = String(note || '').trim();
  const safeRequestedInfo = escapeHtml(requestedInfo).replace(/\r\n|\r|\n/g, '<br>');
  const vars = {
    email: user.email || '',
    userId: String(user.id ?? ''),
    username: user.username || user.email || '',
    businessName: user.businessName || '',
    accountStatus: user.accountStatus || '',
    note: safeRequestedInfo,
    requestedInfo: safeRequestedInfo,
  };

  const fallbackSubjects = {
    accountapproved: 'Your Beneki account has been approved',
    accountmoreinfo: 'More information needed for your Beneki account',
    accountrefused: 'Your Beneki registration was not approved',
  };

  // If no CMS template exists for more-info, still send the admin message.
  if (module === 'accountmoreinfo' && requestedInfo) {
    const template = await findEmailTemplate(strapi, module, locale);
    if (!template) {
      await strapi.plugin('email').service('email').send({
        to: user.email,
        subject: fallbackSubjects.accountmoreinfo,
        html: `
          <p>We need a little more information before we can activate your account:</p>
          ${buildNoteHtml(requestedInfo)}
          <p>Please reply to this email with the required details.</p>
          <p>Thanks.</p>
        `,
      });
      return true;
    }

    const appendNoteHtml = templateMentionsNote(template)
      ? ''
      : buildNoteHtml(requestedInfo);

    return sendTemplatedEmail(strapi, {
      to: user.email,
      module,
      locale,
      vars,
      fallbackSubject: fallbackSubjects[module],
      appendNoteHtml,
    });
  }

  return sendTemplatedEmail(strapi, {
    to: user.email,
    module,
    locale,
    vars,
    fallbackSubject: fallbackSubjects[module],
  });
}

function resolveLocaleFromContext(ctx) {
  const bodyLocale = ctx.request?.body?.locale;
  if (bodyLocale) return bodyLocale;

  const queryLocale = ctx.query?.locale;
  if (queryLocale) return queryLocale;

  const acceptLanguage = ctx.request?.headers?.['accept-language'];
  if (acceptLanguage) {
    return String(acceptLanguage).split(',')[0].trim();
  }

  return 'en';
}

module.exports = {
  sendRegistrationConfirmationEmail,
  sendRegistrationAdminNotifyEmail,
  sendAccountReviewDecisionEmail,
  resolveLocaleFromContext,
  findEmailTemplate,
  applyPlaceholders,
};
