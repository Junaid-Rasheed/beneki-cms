'use strict';

const LOGIN_UID = 'api::static-auth-login.static-auth-login';
const REGISTER_UID = 'api::static-auth-register.static-auth-register';

const LOGIN_COPY = {
  fr: {
    authPanelTitle:
      "L'espace pro des gestionnaires de locations courte durée",
    authPanelDescription:
      "Kits d'accueil, amenities et consommables, commandés en quelques clics pour tous vos logements.",
    authPanelPoint1: 'Compte réservé aux professionnels (SIREN requis)',
    authPanelPoint2:
      'Votre compte est vérifié par notre équipe avant activation',
    authPanelPoint3: 'Inscription en 3 étapes, environ 2 minutes',
    loginWelcomeTitle: 'Bon retour',
    loginSubtitle: 'Connectez-vous pour commander et suivre vos livraisons.',
    loginShowPassword: 'Afficher',
    loginHidePassword: 'Masquer',
  },
  en: {
    authPanelTitle: 'The pro space for short-term rental managers',
    authPanelDescription:
      'Welcome kits, amenities and consumables, ordered in a few clicks for all your properties.',
    authPanelPoint1: 'Account reserved for professionals (SIREN required)',
    authPanelPoint2: 'Your account is verified by our team before activation',
    authPanelPoint3: 'Sign-up in 3 steps, about 2 minutes',
    loginWelcomeTitle: 'Welcome back',
    loginSubtitle: 'Sign in to order and track your deliveries.',
    loginShowPassword: 'Show',
    loginHidePassword: 'Hide',
  },
};

const REGISTER_COPY = {
  fr: {
    registerStepCounter: 'Étape {current} sur {total}',
    registerStep1Title: 'Votre entreprise',
    registerStep1Subtitle:
      'Le compte est réservé aux professionnels. Le SIREN est requis.',
    registerStep2Title: 'Vos logements',
    registerStep2Subtitle:
      'Quelques informations pour que notre équipe puisse vérifier votre compte.',
    registerStep3Title: 'Créer votre accès',
    registerStep3Subtitle:
      'Un e-mail et un mot de passe suffisent pour commencer.',
    registerContinueButton: 'Continuer',
    registerBackButton: 'Retour',
    registerShowPassword: 'Afficher',
    registerHidePassword: 'Masquer',
    registerEmailRequired: "L'adresse e-mail est requise.",
    registerPasswordRequired: 'Le mot de passe est requis.',
  },
  en: {
    registerStepCounter: 'Step {current} of {total}',
    registerStep1Title: 'Your business',
    registerStep1Subtitle:
      'This account is reserved for professionals. A registration number is required.',
    registerStep2Title: 'Your properties',
    registerStep2Subtitle: 'A few details so our team can review your account.',
    registerStep3Title: 'Create your access',
    registerStep3Subtitle: 'An email and a password are enough to get started.',
    registerContinueButton: 'Continue',
    registerBackButton: 'Back',
    registerShowPassword: 'Show',
    registerHidePassword: 'Hide',
    registerEmailRequired: 'Email is required.',
    registerPasswordRequired: 'Password is required.',
  },
};

function missingFields(existing, defaults) {
  const data = {};
  for (const [key, value] of Object.entries(defaults)) {
    const current = existing?.[key];
    if (current == null || String(current).trim() === '') {
      data[key] = value;
    }
  }
  return data;
}

async function ensureLocale(strapi, uid, locale, defaults) {
  let published = null;
  let draft = null;
  try {
    published = await strapi.documents(uid).findFirst({
      locale,
      status: 'published',
    });
  } catch (err) {
    strapi.log.warn(
      `[auth-page-static] Could not read published ${uid} (${locale}): ${err.message}`
    );
  }
  try {
    draft = await strapi.documents(uid).findFirst({
      locale,
      status: 'draft',
    });
  } catch (err) {
    strapi.log.warn(
      `[auth-page-static] Could not read draft ${uid} (${locale}): ${err.message}`
    );
  }

  if (!published && !draft) {
    await strapi.documents(uid).create({
      data: defaults,
      locale,
      status: 'published',
    });
    strapi.log.info(`[auth-page-static] Created ${uid} (${locale})`);
    return;
  }

  const source = published || draft;
  const data = missingFields(source, defaults);
  if (!Object.keys(data).length) return;

  const targets = [];
  if (published) targets.push('published');
  if (draft) targets.push('draft');
  if (!targets.length) targets.push('published');

  for (const status of targets) {
    await strapi.documents(uid).update({
      documentId: source.documentId,
      locale,
      data,
      status,
    });
  }

  strapi.log.info(
    `[auth-page-static] Filled ${Object.keys(data).join(', ')} on ${uid} (${locale})`
  );
}

async function ensureAuthPageStatic(strapi) {
  for (const [locale, defaults] of Object.entries(LOGIN_COPY)) {
    await ensureLocale(strapi, LOGIN_UID, locale, defaults);
  }
  for (const [locale, defaults] of Object.entries(REGISTER_COPY)) {
    await ensureLocale(strapi, REGISTER_UID, locale, defaults);
  }
}

module.exports = { ensureAuthPageStatic };
