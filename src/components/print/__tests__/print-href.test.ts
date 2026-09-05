import { describe, expect, it } from "vitest";
import { withAutoPrint } from "@/components/print/PrintFactureLink";

describe("facture print links", () => {
  it("opens the browser print dialog from a facture link", () => {
    expect(withAutoPrint("/print/order/abc")).toBe("/print/order/abc?print=1");
    expect(withAutoPrint("/print/table/t1?print=1")).toBe("/print/table/t1?print=1");
    expect(withAutoPrint("/print/table/t1?foo=1")).toBe("/print/table/t1?foo=1&print=1");
    expect(withAutoPrint("/print/slip/order/abc")).toBe("/print/slip/order/abc?print=1");
  });
});
