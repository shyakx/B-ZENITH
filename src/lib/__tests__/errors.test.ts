import { describe, expect, it } from "vitest";
import { AppError, fail, toErrorMessage } from "@/lib/errors";

describe("action error messages", () => {
  it("keeps staff-facing strings like Wrong PIN", () => {
    expect(toErrorMessage("Wrong PIN.")).toBe("Wrong PIN.");
    expect(toErrorMessage("Staff member not found.")).toBe("Staff member not found.");
    expect(fail("Wrong PIN.")).toEqual({ ok: false, error: "Wrong PIN." });
  });

  it("uses AppError and Error messages", () => {
    expect(toErrorMessage(new AppError("Both PINs must match."))).toBe("Both PINs must match.");
    expect(toErrorMessage(new Error("Could not save."))).toBe("Could not save.");
  });

  it("falls back when the value is empty", () => {
    expect(toErrorMessage("")).toBe("Something went wrong.");
    expect(toErrorMessage(null)).toBe("Something went wrong.");
  });
});
