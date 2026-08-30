import { describe, expect, it } from "vitest";
import {
  BUSINESS_TIMEZONE,
  endOfDay,
  formatDate,
  formatDateTime,
  formatReportRange,
  getRwandaDate,
  isOnRwandaDate,
  parseDateInput,
  rwandaDayRange,
  startOfDay,
  toDateInput,
} from "@/lib/dates";

describe("Rwanda calendar dates", () => {
  it("uses Africa/Kigali as the business timezone", () => {
    expect(BUSINESS_TIMEZONE).toBe("Africa/Kigali");
  });

  it("assigns 11:55 PM Rwanda to August 30 and 12:05 AM Rwanda to August 31", () => {
    const late = new Date("2026-08-30T21:55:00.000Z");
    const afterMidnight = new Date("2026-08-30T22:05:00.000Z");

    expect(getRwandaDate(late)).toBe("2026-08-30");
    expect(formatDate(late)).toBe("August 30, 2026");
    expect(getRwandaDate(afterMidnight)).toBe("2026-08-31");
    expect(formatDate(afterMidnight)).toBe("August 31, 2026");
  });

  it("puts 11:59 PM on the previous date and 12:01 AM on the new date", () => {
    const beforeMidnight = new Date("2026-08-30T21:59:00.000Z");
    const afterMidnight = new Date("2026-08-30T22:01:00.000Z");

    expect(getRwandaDate(beforeMidnight)).toBe("2026-08-30");
    expect(getRwandaDate(afterMidnight)).toBe("2026-08-31");
    expect(isOnRwandaDate(beforeMidnight, "2026-08-30")).toBe(true);
    expect(isOnRwandaDate(afterMidnight, "2026-08-30")).toBe(false);
  });

  it("includes current-day events and excludes the previous Rwanda date", () => {
    const current = new Date("2026-08-30T10:00:00.000Z");
    const previous = new Date("2026-08-29T10:00:00.000Z");
    const { from, to, label } = rwandaDayRange(current);

    expect(label).toBe("August 30, 2026");
    expect(current.getTime()).toBeGreaterThanOrEqual(from.getTime());
    expect(current.getTime()).toBeLessThanOrEqual(to.getTime());
    expect(previous.getTime()).toBeLessThan(from.getTime());
  });

  it("keeps order date and payment date independent across midnight", () => {
    const orderCreated = new Date("2026-08-30T21:55:00.000Z");
    const paymentRecorded = new Date("2026-08-30T22:05:00.000Z");
    const august30 = rwandaDayRange("2026-08-30");
    const august31 = rwandaDayRange("2026-08-31");

    expect(formatDate(orderCreated)).toBe("August 30, 2026");
    expect(formatDate(paymentRecorded)).toBe("August 31, 2026");
    expect(orderCreated.getTime()).toBeGreaterThanOrEqual(august30.from.getTime());
    expect(orderCreated.getTime()).toBeLessThanOrEqual(august30.to.getTime());
    expect(paymentRecorded.getTime()).toBeGreaterThanOrEqual(august31.from.getTime());
    expect(paymentRecorded.getTime()).toBeLessThanOrEqual(august31.to.getTime());
    expect(paymentRecorded.getTime()).toBeGreaterThan(august30.to.getTime());
  });

  it("keeps pay-later creation and settlement on their own dates", () => {
    const payLaterCreated = new Date("2026-08-30T18:00:00.000Z");
    const settled = new Date("2026-08-31T07:00:00.000Z");

    expect(formatDate(payLaterCreated)).toBe("August 30, 2026");
    expect(formatDate(settled)).toBe("August 31, 2026");
    expect(isOnRwandaDate(settled, payLaterCreated)).toBe(false);
  });

  it("does not include August 30 when the selected report date is August 29", () => {
    const { from, to, label } = rwandaDayRange("2026-08-29");
    const august30Morning = new Date("2026-08-29T22:01:00.000Z");

    expect(label).toBe("August 29, 2026");
    expect(parseDateInput("2026-08-29").getTime()).toBe(from.getTime());
    expect(august30Morning.getTime()).toBeGreaterThan(to.getTime());
    expect(isOnRwandaDate(august30Morning, "2026-08-29")).toBe(false);
    expect(formatReportRange(from, to)).toBe("August 29, 2026");
  });

  it("formats timestamps in Rwanda time and does not use UTC calendar keys", () => {
    const payment = new Date("2026-08-30T22:05:00.000Z");
    const evening = new Date("2026-08-30T18:42:00.000Z");
    expect(formatDateTime(payment)).toBe("August 31, 2026 · 12:05 AM");
    expect(formatDateTime(evening)).toBe("August 30, 2026 · 8:42 PM");
    expect(toDateInput(payment)).toBe("2026-08-31");
    expect(toDateInput(payment)).not.toBe(payment.toISOString().slice(0, 10));
  });
});
