import { describe, expect, it } from "vitest";
import { requirePurgeConfirm } from "@/services/admin-purge";

describe("admin purge confirm", () => {
  it("accepts DELETE and rejects other text", () => {
    expect(() => requirePurgeConfirm("DELETE")).not.toThrow();
    expect(() => requirePurgeConfirm("delete")).not.toThrow();
    expect(() => requirePurgeConfirm("remove")).toThrow(/Type DELETE/);
  });
});
