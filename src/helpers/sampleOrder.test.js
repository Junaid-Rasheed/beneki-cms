"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { isSampleOrder, orderItemsIncludeSampleProduct } = require("./sampleOrder");

test("SMP product id marks an order as a sample", () => {
  const order = {
    total: 0,
    orderItems: [{ productId: "SMP" }, { productId: "TEA" }],
  };
  assert.equal(isSampleOrder(order), true);
  assert.equal(orderItemsIncludeSampleProduct(order.orderItems), true);
});

test("zero total without SMP is not a sample", () => {
  assert.equal(
    isSampleOrder({
      total: 0,
      discountAmount: 100,
      orderItems: [{ productId: "KIT" }],
    }),
    false,
  );
});

test("legacy empty sample request is still a sample", () => {
  assert.equal(
    isSampleOrder({
      notes: "Free sample request",
      orderItems: [],
      total: 0,
    }),
    true,
  );
});
