import { describe, expect, it } from "vitest";
import { staffInitials } from "@/lib/domain/staff-name";
import { nextPinValue } from "@/lib/domain/pin-input";

describe("staff display names", () => {
  it("builds compact initials", () => {
    expect(staffInitials("LILY MANAGER")).toBe("LM");
    expect(staffInitials("SHYAKX")).toBe("SH");
    expect(staffInitials("Ben")).toBe("BE");
  });
});

describe("PIN keypad", () => {
  it("edits a PIN without going past 6 digits", () => {
    expect(nextPinValue("", "1")).toBe("1");
    expect(nextPinValue("12", "←")).toBe("1");
    expect(nextPinValue("12", "C")).toBe("");
    expect(nextPinValue("123456", "7")).toBe("123456");
  });
});
