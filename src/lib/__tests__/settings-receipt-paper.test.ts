import { describe, expect, it } from "vitest";
import { parseReceiptPaperMm } from "@/lib/settings";

describe("receipt paper size", () => {
  it("uses the 80mm bill roll unless 58mm is chosen", () => {
    expect(parseReceiptPaperMm(undefined)).toBe("80");
    expect(parseReceiptPaperMm("")).toBe("80");
    expect(parseReceiptPaperMm("A4")).toBe("80");
    expect(parseReceiptPaperMm("80")).toBe("80");
    expect(parseReceiptPaperMm("58")).toBe("58");
  });
});
