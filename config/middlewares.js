module.exports = [
  'strapi::logger',
  'strapi::errors',
     {
        name: 'strapi::security',
        config: {
          contentSecurityPolicy: {
            useDefaults: true,
            directives: {
              'connect-src': ["'self'", 'https:'],
              'img-src': ["'self'", 'data:', 'blob:', 'res.cloudinary.com'],
              'media-src': ["'self'", 'data:', 'blob:', 'res.cloudinary.com'],
              upgradeInsecureRequests: null,
            },
          },
        },
      },
      {
        name: 'strapi::cors',
        config: {
          enabled: true,
          origin: [process.env.FRONTEND_URL_LOCAL], // Replace with your frontend URL
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          headers: '*',
          credentials: true,
        },
      },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
