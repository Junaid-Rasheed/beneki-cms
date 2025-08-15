module.exports = ({ env }) => ({
  // Cloudinary upload configuration
  upload: {
    config: {
      provider: "cloudinary",
      providerOptions: {
        cloud_name: env("CLOUDINARY_NAME"),
        api_key: env("CLOUDINARY_KEY"),
        api_secret: env("CLOUDINARY_SECRET"),
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },

  // SendGrid email configuration
  email: {
    config: {
      provider: 'sendgrid',
      providerOptions: {
        apiKey: env('SENDGRID_API_KEY'),
      },
      settings: {
        defaultFrom: 'elveniaschmall@gmail.com',
        defaultReplyTo: 'elveniaschmall@gmail.com',
      },
    },
  },

  // Users-permissions plugin configuration (merged into one)
  // 'users-permissions': {
  //   config: {
  //     forgotPassword: {
  //       resetPasswordUrl: 'http://localhost:5173/reset-password', // Match your frontend URL
  //     },
  //   },
  // },
  // config/plugins.js
'users-permissions': {
  config: {
    forgotPassword: {
      resetPasswordUrl: (user) => {
        return `http://localhost:5173/reset-password/${user.resetPasswordToken}`;
      }
    }
  }
}
});
