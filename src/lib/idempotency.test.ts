import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSerializationFailure,
  isUniqueConstraint,
  runIdempotentCreate,
  salePublicPayload,
  scopedIdempotencyKey,
} from "./idempotency";

describe("checkout idempotency", () => {
  it("scopes keys to the cashier so two users cannot collide", () => {
    const key = "11111111-1111-4111-8111-111111111111";
    assert.notEqual(scopedIdempotencyKey("userA", key), scopedIdempotencyKey("userB", key));
    assert.equal(scopedIdempotencyKey("userA", key.toUpperCase()), scopedIdempotencyKey("userA", key));
  });

  it("returns the original sale when the same key is submitted again", async () => {
    const sale = { id: "sale-1", receiptNumber: "BZ-20260821-000001", total: "1500.00" };
    let creates = 0;
    const first = await runIdempotentCreate({
      findExisting: async () => null,
      create: async () => {
        creates += 1;
        return sale;
      },
    });
    const second = await runIdempotentCreate({
      findExisting: async () => sale,
      create: async () => {
        creates += 1;
        return { id: "sale-2", receiptNumber: "BZ-20260821-000002", total: "1500.00" };
      },
    });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.value.id, "sale-1");
    assert.equal(creates, 1);
  });

  it("treats a unique-constraint race as the original sale", async () => {
    const sale = { id: "sale-1", receiptNumber: "BZ-20260821-000001", total: { toFixed: () => "2000.00" } };
    const result = await runIdempotentCreate({
      findExisting: async () => sale,
      create: async () => {
        throw { code: "P2002" };
      },
    });
    assert.equal(result.created, false);
    assert.deepEqual(salePublicPayload(result.value), {
      id: "sale-1",
      receiptNumber: "BZ-20260821-000001",
      total: "2000.00",
    });
  });

  it("returns the existing sale if serialization fails after a concurrent commit", async () => {
    let creates = 0;
    const sale = { id: "sale-1", receiptNumber: "R", total: "1.00" };
    const result = await runIdempotentCreate({
      findExisting: async () => (creates > 0 ? sale : null),
      create: async () => {
        creates += 1;
        throw { code: "P2034" };
      },
    });
    assert.equal(creates, 1);
    assert.equal(result.created, false);
    assert.equal(result.value.id, "sale-1");
  });

  it("retries create after a serialization rollback", async () => {
    let creates = 0;
    const result = await runIdempotentCreate({
      findExisting: async () => null,
      create: async () => {
        creates += 1;
        if (creates === 1) throw { code: "P2034" };
        return { id: "sale-1", receiptNumber: "R", total: "1.00" };
      },
    });
    assert.equal(creates, 2);
    assert.equal(result.created, true);
  });

  it("does not retry unique errors by creating another sale", async () => {
    const sale = { id: "existing", receiptNumber: "R1", total: "10.00" };
    let creates = 0;
    const result = await runIdempotentCreate({
      findExisting: async () => (creates === 0 ? null : sale),
      create: async () => {
        creates += 1;
        throw { code: "P2002" };
      },
    });
    assert.equal(creates, 1);
    assert.equal(result.created, false);
    assert.equal(result.value.id, "existing");
  });

  it("recognizes Prisma serialization and unique codes", () => {
    assert.equal(isSerializationFailure({ code: "P2034" }), true);
    assert.equal(isUniqueConstraint({ code: "P2002" }), true);
    assert.equal(isSerializationFailure(new Error("nope")), false);
  });

  it("allows different keys to create different sales", async () => {
    const created: string[] = [];
    for (const key of ["a", "b"]) {
      const result = await runIdempotentCreate({
        findExisting: async () => created.includes(key) ? { id: key, receiptNumber: key, total: "1.00" } : null,
        create: async () => {
          created.push(key);
          return { id: key, receiptNumber: key, total: "1.00" };
        },
      });
      assert.equal(result.created, true);
    }
    assert.deepEqual(created, ["a", "b"]);
  });
});
