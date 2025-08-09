module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
   axepta: {
    merchantId: env('AXEPTA_MERCHANT_ID'),
    apiUrl: env('AXEPTA_API_URL', 'https://api.axepta.bnpparibas'),
    hmacKey: env('AXEPTA_HMAC_KEY'), // For request signing
    redirectBaseUrl: env('AXEPTA_REDIRECT_BASE_URL', 'https://your-frontend-url.com'),
    environment: env('AXEPTA_ENV', 'test') // test or production
  },
});
