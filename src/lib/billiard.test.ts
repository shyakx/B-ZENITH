import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBilliardAmount, sumBilliardAmounts } from "./billiard";

describe("billiard daily amount", () => {
  it("accepts a positive whole-franc total", () => {
    assert.equal(parseBilliardAmount("15000"), 15000);
    assert.equal(parseBilliardAmount("15,000"), 15000);
  });

  it("rejects empty, zero, and oversized totals", () => {
    assert.equal(parseBilliardAmount(""), null);
    assert.equal(parseBilliardAmount(0), null);
    assert.equal(parseBilliardAmount(-5), null);
    assert.equal(parseBilliardAmount(100_000_001), null);
  });

  it("sums operator totals for the day", () => {
    assert.equal(
      sumBilliardAmounts([{ amount: 8000 }, { amount: { toNumber: () => 2000 } }]),
      10000,
    );
  });
});
