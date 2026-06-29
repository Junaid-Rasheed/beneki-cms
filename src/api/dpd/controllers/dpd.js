"use strict";

const dpdService = require("../services/dpd");

module.exports = {
  async generateMultiLabel(ctx) {
    try {
      const body = ctx.request.body;

      await dpdService.generateShipment(body);

      ctx.status = 200;
      ctx.body = {
        success: true,
        message: "Labels generated successfully",
      };
    } catch (error) {
      console.error(error);

      ctx.status = 500;
      ctx.body = {
        success: false,
        message: error.message || "Failed to generate labels",
      };
    }
  },
};
