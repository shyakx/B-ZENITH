import { endOfDay, startOfDay, toDateInput } from "@/lib/dates";

export type SearchParams = Record<string, string | string[] | undefined>;

export function singleParam(params: SearchParams, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

export function validDateParam(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  return (
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day
  );
}

export function dateRange(params: SearchParams) {
  const rawFrom = singleParam(params, "from");
  const rawTo = singleParam(params, "to");
  const fromDate = validDateParam(rawFrom) ? rawFrom : undefined;
  const toDate = validDateParam(rawTo) ? rawTo : undefined;
  const selectedDate = fromDate ?? toDate ?? toDateInput();
  const fromValue = fromDate ?? selectedDate;
  const toValue = toDate ?? selectedDate;

  return {
    from: startOfDay(fromValue),
    to: endOfDay(toValue),
    fromValue,
    toValue,
  };
}

export function validAmountParam(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : undefined;
}
