import { describe, expect, it } from "vitest";
import { staffGreeting } from "@/lib/greeting";

describe("waiter greeting", () => {
  it("uses the waiter's name", () => {
    expect(staffGreeting("John", new Date("2026-08-30T20:00:00"))).toBe("Good evening, John");
    expect(staffGreeting("Mary", new Date("2026-08-30T09:00:00"))).toBe("Good morning, Mary");
  });
});
