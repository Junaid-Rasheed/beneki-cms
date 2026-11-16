'use strict';

const HOME_UID = 'api::static-content.static-content';
const FOOTER_UID = 'api::footer.footer';

const HOME_COPY = {
  fr: {
    homeProductsTitle: 'Nos produits',
    homeProductsEmptyMessage: 'Aucun produit pour le moment.',
    trustSectionSubtitle:
      'Conciergeries et gestionnaires de locations courte durée.',
    homeProCtaTitle: 'Vous gérez des locations courte durée ?',
    homeProCtaDescription:
      "Créez votre compte pro et commandez en quelques clics. Nous vérifions votre entreprise avant l'activation.",
    homeProCtaButton: 'Créer un compte pro',
    headerAccountLabel: 'Mon compte',
  },
  en: {
    homeProductsTitle: 'Our products',
    homeProductsEmptyMessage: 'No products present.',
    trustSectionSubtitle:
      'Concierge companies and short-term rental managers.',
    homeProCtaTitle: 'Do you manage short-term rentals?',
    homeProCtaDescription:
      'Create your pro account and order in a few clicks. We verify your business before activation.',
    homeProCtaButton: 'Create a pro account',
    headerAccountLabel: 'My account',
  },
  it: {
    homeProductsTitle: 'I nostri prodotti',
    homeProductsEmptyMessage: 'Nessun prodotto al momento.',
    trustSectionSubtitle:
      'Concierge e gestori di affitti brevi.',
    homeProCtaTitle: 'Gestisci affitti brevi?',
    homeProCtaDescription:
      "Crea il tuo account pro e ordina in pochi clic. Verifichiamo la tua azienda prima dell'attivazione.",
    homeProCtaButton: 'Crea un account pro',
    headerAccountLabel: 'Il mio account',
  },
  es: {
    homeProductsTitle: 'Nuestros productos',
    homeProductsEmptyMessage: 'Ningún producto por el momento.',
    trustSectionSubtitle:
      'Conserjerías y gestores de alquileres de corta duración.',
    homeProCtaTitle: '¿Gestionas alquileres de corta duración?',
    homeProCtaDescription:
      'Crea tu cuenta pro y pide en unos clics. Verificamos tu empresa antes de la activación.',
    homeProCtaButton: 'Crear una cuenta pro',
    headerAccountLabel: 'Mi cuenta',
  },
  pt: {
    homeProductsTitle: 'Os nossos produtos',
    homeProductsEmptyMessage: 'Nenhum produto de momento.',
    trustSectionSubtitle:
      'Concierges e gestores de arrendamentos de curta duração.',
    homeProCtaTitle: 'Gere arrendamentos de curta duração?',
    homeProCtaDescription:
      'Crie a sua conta pro e encomende em poucos cliques. Verificamos a sua empresa antes da ativação.',
    homeProCtaButton: 'Criar uma conta pro',
    headerAccountLabel: 'A minha conta',
  },
};

const FOOTER_COPY = {
  fr: {
    footerPrivacyPolicyLink: 'Politique de confidentialité',
  },
  en: {
    footerPrivacyPolicyLink: 'Privacy policy',
  },
  it: {
    footerPrivacyPolicyLink: 'Informativa sulla privacy',
  },
  es: {
    footerPrivacyPolicyLink: 'Política de privacidad',
  },
  pt: {
    footerPrivacyPolicyLink: 'Política de privacidade',
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
      `[home-page-static] Could not read published ${uid} (${locale}): ${err.message}`
    );
  }
  try {
    draft = await strapi.documents(uid).findFirst({
      locale,
      status: 'draft',
    });
  } catch (err) {
    strapi.log.warn(
      `[home-page-static] Could not read draft ${uid} (${locale}): ${err.message}`
    );
  }

  if (!published && !draft) {
    await strapi.documents(uid).create({
      data: defaults,
      locale,
      status: 'published',
    });
    strapi.log.info(`[home-page-static] Created ${uid} (${locale})`);
    return;
  }

  const source = published || draft;
  const data = missingFields(source, defaults);
  if (!Object.keys(data).length) return;

  const targets = [];
  if (published) targets.push('published');
  if (draft) targets.push('draft');

  for (const status of targets) {
    await strapi.documents(uid).update({
      documentId: source.documentId,
      locale,
      data,
      status,
    });
  }

  strapi.log.info(
    `[home-page-static] Filled ${Object.keys(data).join(', ')} on ${uid} (${locale})`
  );
}

async function ensureHomePageStatic(strapi) {
  for (const [locale, defaults] of Object.entries(HOME_COPY)) {
    await ensureLocale(strapi, HOME_UID, locale, defaults);
  }
  for (const [locale, defaults] of Object.entries(FOOTER_COPY)) {
    await ensureLocale(strapi, FOOTER_UID, locale, defaults);
  }
}

module.exports = { ensureHomePageStatic };
