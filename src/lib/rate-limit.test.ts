import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rateLimit, resetRateLimitForTests } from "./rate-limit";

describe("staff rate limit", () => {
  it("allows requests under the cap and blocks afterwards", () => {
    resetRateLimitForTests();
    const first = rateLimit("staff:1.1.1.1", 2, 60_000);
    const second = rateLimit("staff:1.1.1.1", 2, 60_000);
    const third = rateLimit("staff:1.1.1.1", 2, 60_000);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(third.ok, false);
  });

  it("does not share buckets across IPs", () => {
    resetRateLimitForTests();
    rateLimit("staff:10.0.0.1", 1, 60_000);
    const other = rateLimit("staff:10.0.0.2", 1, 60_000);
    assert.equal(other.ok, true);
  });
});
