
// const crypto = require("crypto");

// module.exports = {
//   async forgotPassword(ctx) {
//     const { email, locale } = ctx.request.body;

//     if (!email) {
//       return ctx.badRequest("Email is required");
//     }

//     // find user
//     const user = await strapi.db
//       .query("plugin::users-permissions.user")
//       .findOne({
//         where: { email },
//       });

//     if (!user) {
//       return ctx.badRequest("User not found");
//     }

//     // generate reset token
//     const resetToken = crypto.randomBytes(64).toString("hex");

//     // save token in user
//     await strapi.db
//       .query("plugin::users-permissions.user")
//       .update({
//         where: { id: user.id },
//         data: { resetPasswordToken: resetToken },
//       });

//     // email content
//     let subject;
//     let message;
//     let buttonText;
//     let thanksText;

//     if (locale === "fr") {
//       subject = "Réinitialiser votre mot de passe BENEKI";
//       message = "Voici le lien pour réinitialiser votre mot de passe :";
//       buttonText = "Réinitialiser mon mot de passe";
//       thanksText = "MERCI";
//     } else {
//       subject = "Reset your BENEKI password";
//       message =
//         "Here is the link to reset your password. If you did not request this, please contact us.";
//       buttonText = "Reset my password";
//       thanksText = "THANKS";
//     }

//     const baseUrl = process.env.FRONTEND_URL.replace(/\/$/, "");
//     const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

//     // send email
//     await strapi.plugin("email").service("email").send({
//       to: email,
//       subject,
//       html: `
//         <p>${message}</p>

//         <p>
//           <a href="${resetUrl}"
//              style="
//                background:#4d604a;
//                color:white;
//                padding:12px 20px;
//                text-decoration:none;
//                border-radius:6px;
//                display:inline-block;
//                font-weight:600;
//              ">
//              ${buttonText}
//           </a>
//         </p>

        
//         <p style="margin-top:30px;">
//           ${thanksText}
//         </p>
//       `,
//     });

//     ctx.send({ ok: true });
//   },
// };

const crypto = require("crypto");

module.exports = {
  async forgotPassword(ctx) {
    const { email, locale } = ctx.request.body;

    if (!email) {
      return ctx.badRequest("Email is required");
    }

    // find user
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        where: { email },
      });

    if (!user) {
      return ctx.badRequest("User not found");
    }

    // generate reset token
    const resetToken = crypto.randomBytes(64).toString("hex");

    // save token to user
    await strapi.db
      .query("plugin::users-permissions.user")
      .update({
        where: { id: user.id },
        data: { resetPasswordToken: resetToken },
      });

    // normalize locale (fr-FR -> fr)
    const normalizedLocale = locale?.split("-")[0] || "en";

    // fetch template for locale
    let templates = await strapi.db
      .query("api::email-reset-template.email-reset-template")
      .findMany({
        where: { locale: normalizedLocale },
        limit: 1,
      });

    // fallback to English
    if (!templates.length) {
      templates = await strapi.db
        .query("api::email-reset-template.email-reset-template")
        .findMany({
          where: { locale: "en" },
          limit: 1,
        });
    }

    const template = templates[0];

    if (!template) {
      return ctx.badRequest("Email template not found");
    }

    const { subject, message, buttonText, thanksText } = template;

    const baseUrl = process.env.FRONTEND_URL.replace(/\/$/, "");
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

    // send email
    await strapi.plugin("email").service("email").send({
      to: email,
      subject,
      html: `
        <p>${message}</p>

        <p>
          <a href="${resetUrl}"
             style="
               background:#4d604a;
               color:white;
               padding:12px 20px;
               text-decoration:none;
               border-radius:6px;
               display:inline-block;
               font-weight:600;
             ">
             ${buttonText}
          </a>
        </p>

        <p style="margin-top:30px;">
          ${thanksText}
        </p>
      `,
    });

    ctx.send({ ok: true });
  },
};