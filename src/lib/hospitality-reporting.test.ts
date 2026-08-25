import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateAdjustments,
  aggregateChannelSales,
  aggregateCreditBills,
  aggregatePaymentRecords,
  aggregatePostedBy,
} from "./hospitality-reporting";

describe("hospitality reporting aggregators", () => {
  it("aggregates split payments from Payment records, not a single sale method", () => {
    const totals = aggregatePaymentRecords([
      { method: "CASH", amount: 500 },
      { method: "MOBILE_MONEY", amount: 1500 },
      { method: "CASH", amount: 200 },
    ]);
    assert.equal(totals.get("CASH")?.amount, 700);
    assert.equal(totals.get("CASH")?.count, 2);
    assert.equal(totals.get("MOBILE_MONEY")?.amount, 1500);
    assert.equal(totals.has("CARD"), false);
  });

  it("attributes rounds to postedBy, not the current waiter", () => {
    const totals = aggregatePostedBy([
      { postedById: "waiter-1", postedByName: "Ada", itemCount: 2 },
      { postedById: "waiter-1", postedByName: "Ada", itemCount: 1 },
      { postedById: "waiter-2", postedByName: "Ben", itemCount: 4 },
    ]);
    assert.equal(totals.get("waiter-1")?.rounds, 2);
    assert.equal(totals.get("waiter-1")?.items, 3);
    assert.equal(totals.get("waiter-2")?.items, 4);
    assert.equal(totals.has("current-waiter"), false);
  });

  it("counts VOID, RETURN, EXCHANGE, and WASTE adjustments", () => {
    const totals = aggregateAdjustments([
      { type: "VOID", quantity: 2 },
      { type: "RETURN", quantity: 1 },
      { type: "EXCHANGE", quantity: 1 },
      { type: "WASTE", quantity: 3 },
    ]);
    assert.equal(totals.get("VOID")?.count, 1);
    assert.equal(totals.get("VOID")?.quantity, 2);
    assert.equal(totals.get("RETURN")?.quantity, 1);
    assert.equal(totals.get("EXCHANGE")?.count, 1);
    assert.equal(totals.get("WASTE")?.quantity, 3);
  });

  it("tracks outstanding, partial, paid, and written-off credit balances", () => {
    const totals = aggregateCreditBills([
      { status: "OUTSTANDING", total: 2000, balance: 2000 },
      { status: "PARTIALLY_PAID", total: 3000, balance: 1000 },
      { status: "PAID", total: 1500, balance: 0 },
      { status: "WRITTEN_OFF", total: 400, balance: 0 },
    ]);
    assert.equal(totals.get("OUTSTANDING")?.balance, 2000);
    assert.equal(totals.get("PARTIALLY_PAID")?.balance, 1000);
    assert.equal(totals.get("PAID")?.count, 1);
    assert.equal(totals.get("WRITTEN_OFF")?.total, 400);
  });

  it("groups financial sales by service channel", () => {
    const totals = aggregateChannelSales([
      { channel: "TABLE", total: 4000 },
      { channel: "DELIVERY", total: 2500 },
      { channel: "TABLE", total: 1000 },
      { channel: null, total: 500 },
    ]);
    assert.equal(totals.get("TABLE")?.count, 2);
    assert.equal(totals.get("TABLE")?.total, 5000);
    assert.equal(totals.get("DELIVERY")?.total, 2500);
    assert.equal(totals.get("LEGACY")?.total, 500);
  });
});
