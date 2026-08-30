import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "@/lib/auth/pin";

describe("PIN login", () => {
  it("accepts the correct PIN and rejects the wrong one", async () => {
    const hash = await hashPin("1111");
    expect(await verifyPin("1111", hash)).toBe(true);
    expect(await verifyPin("9999", hash)).toBe(false);
  });
});
