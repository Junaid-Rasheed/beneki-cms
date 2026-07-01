const { generateShipment } = require("../api/dpd/services/dpd");

const STREET_MIN_LETTERS_OR_DIGITS = 5;
const DPD_MAX_PARCEL_WEIGHT_KG = 25;
const MAX_PIECES_PER_PARCEL = 4;

module.exports = {
  async generateMultiLabelByOrderId(orderId) {
    try {
      console.log("generateMultiLabelByOrderId initiating", orderId);
      if (!orderId) {
        throw new Error("Order Id is required");
      }
      const order = await strapi.documents("api::order.order").findOne({
        orderNumber: orderId,
        populate: {
          shippingAddress: true,
          orderItems: true,
        },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      const shippingAddress = order.shippingAddress;

      if (!shippingAddress) {
        throw new Error("Shipping address missing.");
      }
      const receiverFullName = [
        shippingAddress.firstName,
        shippingAddress.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const receiverName =
        receiverFullName || shippingAddress.companyName || "Customer";

      const orderTotal = Number(order.total);
      const isSampleOrder = orderTotal === 0;

      let slaveRequests = [];

      if (isSampleOrder) {
        slaveRequests = [
          {
            weight: "1",
            referencenumber: "sample",
          },
        ];
      } else {
        const products = await strapi
          .documents("api::product.product")
          .findMany({
            populate: "*",
          });

        console.log("products fetched", products);
        const allPieces = [];

        order.orderItems.forEach((item, index) => {
          const foundProduct = this.findProductByIdInTree(
            products,
            item.productId,
          );

          const pieces = this.buildPiecesForOrderLine(
            item,
            foundProduct,
            index,
          );

          allPieces.push(...pieces);
        });

        slaveRequests = this.packPiecesIntoSlaves(allPieces);

        if (!slaveRequests.length) {
          throw new Error("No items to ship.");
        }
      }
      console.log("slaves created");
      //--------------------------------------------------------
      // Delivery Instructions
      //--------------------------------------------------------

      const instruction = shippingAddress.instruction || "";

      const deliveryInstruction = instruction.substring(0, 36);
      const deliveryInstruction2 = instruction.substring(36, 72);

      //--------------------------------------------------------
      // Street
      //--------------------------------------------------------

      const receiverStreet = [
        this.getPrimaryAddressLine(shippingAddress),
        this.getAddressExtraLine(shippingAddress),
      ]
        .filter(Boolean)
        .join(", ");

      //--------------------------------------------------------
      // Payload
      //--------------------------------------------------------

      const payload = {
        shipper: {
          name: "BENEKI",
          countryPrefix: "FR",
          zipCode: "59500",
          city: "Douai",
          street: "691 rue maurice caullery",
          phoneNumber: "0672799030",
        },

        receiver: {
          name: receiverName,
          countryPrefix: this.getCountryPrefix(shippingAddress.country),
          zipCode: shippingAddress.postalCode,
          city: shippingAddress.city,
          street: receiverStreet,
          phoneNumber: shippingAddress.phoneNumber,
          deliveryInstruction,
          deliveryInstruction2,
          companyName: shippingAddress.companyName,
          email: shippingAddress.email,
        },

        slaves: {
          SlaveRequest: slaveRequests,
        },

        orderId: order.documentId,
        orderNumber: order.orderNumber,
      };

      //--------------------------------------------------------
      // Call DPD API
      //--------------------------------------------------------
      console.log("calling generate shipments");
      await generateShipment(payload);

      //--------------------------------------------------------
      // Update Order
      //--------------------------------------------------------

      await strapi.documents("api::order.order").update({
        documentId: order.documentId,
        data: {
          isDpdLabelPrinted: true,
          orderStatus: "shipped",
        },
      });

      return {
        success: true,
      };
    } catch (err) {
      strapi.log.error(err);
      throw err;
    }
  },

  // ---------------- helpers ----------------
  findProductByIdInTree(nodes, productId) {
    if (!productId || !Array.isArray(nodes)) return null;

    const pid = String(productId);

    for (const node of nodes) {
      if (!node) continue;

      if (
        String(node.id) === pid ||
        String(node.documentId) === pid ||
        this.getSidebarProductId(node) === pid
      ) {
        return node;
      }

      if (Array.isArray(node.children) && node.children.length > 0) {
        const found = this.findProductByIdInTree(node.children, productId);
        if (found) return found;
      }
    }

    return null;
  },
  getSidebarProductId(node) {
    if (!node) return null;
    const pid = node.productId ?? node.attributes?.productId;
    if (pid == null || pid === "") return null;
    return String(pid);
  },
  findProductInTree(products, productName) {
    if (!productName || typeof productName !== "string") return null;
    const target = productName.trim();
    if (!target) return null;

    const walk = (nodes, mode) => {
      if (!Array.isArray(nodes)) return null;
      for (const node of nodes) {
        if (!node) continue;
        const title = node.title != null ? String(node.title).trim() : "";
        const productTitle =
          node.productTitle != null ? String(node.productTitle).trim() : "";
        if (mode === "title" && title === target) return node;
        if (mode === "productTitle" && productTitle && productTitle === target)
          return node;
        if (node.children?.length) {
          const found = walk(node.children, mode);
          if (found) return found;
        }
      }
      return null;
    };

    return walk(products, "title") || walk(products, "productTitle") || null;
  },
  buildPiecesForOrderLine(itemData, foundProduct, lineIndex) {
    const productId = itemData.productId;
    const orderQuantity = parseInt(itemData.quantity, 10) || 1;
    const productVariationStr = itemData.productQuantity || "";
    const productVariationValue =
      this.parseVariationNumber(productVariationStr);

    const productMaxVariation = this.parseVariationNumber(
      foundProduct?.maximumVariation,
    );
    const productMaxWeight = this.parseVariationNumber(
      foundProduct?.maximumWeight,
    );

    const unitVariation = productVariationValue > 0 ? productVariationValue : 1;
    const totalVariation = unitVariation * orderQuantity;

    const referenceProductId =
      productId != null && productId !== ""
        ? String(productId)
        : foundProduct?.id != null
          ? String(foundProduct.id)
          : foundProduct?.documentId != null
            ? String(foundProduct.documentId)
            : `LINE-${lineIndex + 1}`;

    const refFor = (variation) =>
      `${this.formatNum(variation)}${referenceProductId}`;

    const pieces = [];

    if (productMaxVariation > 0 && productMaxWeight > 0) {
      const weightPerVariation = productMaxWeight / productMaxVariation;
      // Cap a single piece at min(product.maxWeight, 30 kg) — if the product's
      // max parcel weight exceeds 30 kg, shrink the variation proportionally.
      const cappedMaxWeight = Math.min(
        productMaxWeight,
        DPD_MAX_PARCEL_WEIGHT_KG,
      );
      const effectiveMaxVariation =
        cappedMaxWeight === productMaxWeight
          ? productMaxVariation
          : cappedMaxWeight / weightPerVariation;

      const numPieces = Math.max(
        1,
        Math.ceil(totalVariation / effectiveMaxVariation),
      );
      let remaining = totalVariation;
      for (let i = 0; i < numPieces; i++) {
        const variation =
          i === numPieces - 1 ? Math.max(remaining, 0) : effectiveMaxVariation;
        const weight = Math.min(
          variation * weightPerVariation,
          DPD_MAX_PARCEL_WEIGHT_KG,
        );
        // A piece is "full" when it reaches the per-product max variation.
        // Full pieces ship alone — they cannot be merged with other items.
        const isFull = variation >= effectiveMaxVariation - 1e-6;
        pieces.push({
          lineIndex,
          variation,
          weight,
          reference: refFor(variation),
          isFull,
        });
        remaining -= variation;
      }
      return pieces;
    }

    // Fallback when the product doesn't have both caps configured.
    // Treat the variation amount as kg and only enforce the 30 kg hard cap.
    const fallbackTotal = totalVariation > 0 ? totalVariation : orderQuantity;
    if (fallbackTotal > DPD_MAX_PARCEL_WEIGHT_KG) {
      const numPieces = Math.ceil(fallbackTotal / DPD_MAX_PARCEL_WEIGHT_KG);
      let remaining = fallbackTotal;
      for (let i = 0; i < numPieces; i++) {
        const w =
          i === numPieces - 1
            ? Math.max(remaining, 0)
            : DPD_MAX_PARCEL_WEIGHT_KG;
        const isFull = w >= DPD_MAX_PARCEL_WEIGHT_KG - 1e-6;
        pieces.push({
          lineIndex,
          variation: w,
          weight: w,
          reference: refFor(w),
          isFull,
        });
        remaining -= w;
      }
    } else {
      pieces.push({
        lineIndex,
        variation: fallbackTotal,
        weight: fallbackTotal,
        reference: refFor(fallbackTotal),
        isFull: false,
      });
    }

    return pieces;
  },
  packPiecesIntoSlaves(pieces) {
    const toSlave = (binPieces, totalWeight) => {
      const references = binPieces
        .map((piece) => piece.reference)
        .filter(Boolean);
      return {
        weight: this.formatNum(totalWeight),
        referencenumber: references.join(" "),
      };
    };

    // Full pieces never combine — they each become their own parcel.
    const fullPieces = pieces.filter((p) => p.isFull);
    const partialPieces = pieces.filter((p) => !p.isFull);

    const fullSlaves = fullPieces.map((piece) =>
      toSlave([piece], piece.weight),
    );

    // First-fit on the partial pieces. Sort largest-first so the biggest
    // remainder anchors each parcel and smaller ones fill in around it.
    const sorted = [...partialPieces].sort((a, b) => b.weight - a.weight);
    const bins = [];

    for (const piece of sorted) {
      let placed = false;
      for (const bin of bins) {
        if (
          bin.weight + piece.weight <= DPD_MAX_PARCEL_WEIGHT_KG &&
          bin.pieces.length < MAX_PIECES_PER_PARCEL &&
          !bin.lineIndexes.has(piece.lineIndex)
        ) {
          bin.pieces.push(piece);
          bin.weight += piece.weight;
          bin.lineIndexes.add(piece.lineIndex);
          placed = true;
          break;
        }
      }
      if (!placed) {
        bins.push({
          pieces: [piece],
          weight: piece.weight,
          lineIndexes: new Set([piece.lineIndex]),
        });
      }
    }

    const partialSlaves = bins.map((bin) => toSlave(bin.pieces, bin.weight));

    return [...fullSlaves, ...partialSlaves];
  },
  getCountryPrefix(country) {
    if (!country) return "FR";
    const value = String(country).trim();
    if (!value) return "FR";
    if (value.length === 2) return value.toUpperCase();
    const map = {
      france: "FR",
      belgium: "BE",
      belgique: "BE",
      germany: "DE",
      deutschland: "DE",
      allemagne: "DE",
      spain: "ES",
      espagne: "ES",
      italy: "IT",
      italie: "IT",
      netherlands: "NL",
      "pays-bas": "NL",
      holland: "NL",
      luxembourg: "LU",
      switzerland: "CH",
      suisse: "CH",
      portugal: "PT",
      austria: "AT",
      autriche: "AT",
      poland: "PL",
      pologne: "PL",
      ireland: "IE",
      irlande: "IE",
      denmark: "DK",
      sweden: "SE",
      norway: "NO",
      finland: "FI",
      "united kingdom": "GB",
      "royaume-uni": "GB",
      uk: "GB",
      "great britain": "GB",
      monaco: "MC",
    };
    return map[value.toLowerCase()] || value.slice(0, 2).toUpperCase();
  },
  getPrimaryAddressLine(address) {
    if (!address) return "";
    const street = String(address.street || "").trim();
    const addressName = String(address.addressName || "").trim();

    if (street && this.isStreetDetailedEnough(street)) {
      return street;
    }
    if (addressName && this.isStreetDetailedEnough(addressName)) {
      return addressName;
    }
    return street || addressName;
  },
  isStreetDetailedEnough(street) {
    return (
      this.countStreetLettersAndDigits(street) >= STREET_MIN_LETTERS_OR_DIGITS
    );
  },
  countStreetLettersAndDigits(street) {
    if (street == null) return 0;
    const matches = String(street).match(/[\p{L}\p{N}]/gu);
    return matches ? matches.length : 0;
  },
  getAddressExtraLine(address) {
    if (!address) return "";
    const extra = String(address.appartment || "").trim();
    if (extra) return extra;

    if (this.isLegacyAddressFormat(address)) {
      return String(address.street || "").trim();
    }
    return "";
  },
  isLegacyAddressFormat(address) {
    if (!address?.street?.trim() || address.appartment?.trim()) return false;
    const street = String(address.street || "").trim();
    const addressName = String(address.addressName || "").trim();
    return (
      this.isStreetDetailedEnough(addressName) &&
      street.length > 0 &&
      !this.isStreetDetailedEnough(street)
    );
  },
  parseVariationNumber(value) {
    if (value === null || value === undefined) return 0;
    const text = String(value).trim();
    if (!text) return 0;
    const match = text.match(/\d+(?:[.,]\d+)?/);
    if (!match) return 0;
    const parsed = parseFloat(match[0].replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  },
  formatNum(value) {
    const rounded = Math.round(value * 1000) / 1000;
    return String(rounded);
  },
};
