import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PIN_LOCK_AFTER, PIN_LOCK_MS, isPinCurrentlyLocked, nextPinFailureState } from "./pin";

describe("PIN lockout helpers", () => {
  it("is not locked when pinLockedUntil is null", () => {
    assert.equal(isPinCurrentlyLocked(null), false);
  });

  it("is locked when pinLockedUntil is in the future", () => {
    const now = new Date("2026-08-25T08:00:00Z");
    assert.equal(isPinCurrentlyLocked(new Date("2026-08-25T08:10:00Z"), now), true);
  });

  it("is not locked when pinLockedUntil is in the past", () => {
    const now = new Date("2026-08-25T08:00:00Z");
    assert.equal(isPinCurrentlyLocked(new Date("2026-08-25T07:00:00Z"), now), false);
  });

  it("locks on the 5th consecutive failure", () => {
    const now = new Date("2026-08-25T08:00:00Z");
    const fourth = nextPinFailureState(3, now);
    assert.equal(fourth.pinFailedAttempts, 4);
    assert.equal(fourth.pinLockedUntil, null);

    const fifth = nextPinFailureState(4, now);
    assert.equal(fifth.pinFailedAttempts, PIN_LOCK_AFTER);
    assert.ok(fifth.pinLockedUntil);
    assert.equal(fifth.pinLockedUntil!.getTime(), now.getTime() + PIN_LOCK_MS);
  });
});
