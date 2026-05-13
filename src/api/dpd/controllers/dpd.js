"use strict";

const dpdService = require("../services/dpd");

module.exports = {
  async generateMultiLabel(ctx) {
    try {
      const body = ctx.request.body;

      const zipBuffer = await dpdService.generateShipment(body);

      ctx.set("Content-Type", "application/zip");

      ctx.set(
        "Content-Disposition",
        `attachment; filename=dpd-labels.zip`
      );

      ctx.body = zipBuffer;
    } catch (error) {
      console.error(error);

      ctx.status = 500;

      ctx.body = {
        error: error.message,
      };
    }
  },
};