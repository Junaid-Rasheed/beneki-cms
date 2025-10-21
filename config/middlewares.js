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
          // enabled: true,
          origin:  ['*'], // Allow all origins
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          headers: '*',
          credentials: false, // Must be false when using '*'
        },
      },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
