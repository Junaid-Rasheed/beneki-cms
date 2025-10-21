// module.exports = {
//   routes: [
//     {
//       method: "POST",
//       path: "/orders/send-invoice",
//       handler: "order.sendInvoice",
//       config: {
//         auth: false, // change to true if you want to require login
//       },
//     },
//   ],
// };


"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/orders/send-invoice",
      handler: "order.sendInvoice",
      config: {
        auth: false,
      },
    },
  ],
};