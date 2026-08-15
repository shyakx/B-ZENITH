export const TIMEZONE = "Africa/Kigali";
export const VENUE_LINE = "Restaurant / Café / Bar / Lounge";

const kigaliOffset = "+02:00";

export function kigaliDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfKigaliDay(yyyyMmDd = kigaliDateString()) {
  return new Date(`${yyyyMmDd}T00:00:00${kigaliOffset}`);
}

export function kigaliRange(from?: string, to?: string, fallbackDays = 30) {
  const today = kigaliDateString();
  const fromDay = from || kigaliDateString(new Date(Date.now() - fallbackDays * 86_400_000));
  const toDay = to || today;
  return {
    fromDay,
    toDay,
    start: startOfKigaliDay(fromDay),
    end: new Date(startOfKigaliDay(toDay).getTime() + 86_400_000),
  };
}

export function todayKigaliRange() {
  const day = kigaliDateString();
  return { start: startOfKigaliDay(day), end: new Date(startOfKigaliDay(day).getTime() + 86_400_000) };
}

export function formatDateTime(date: Date) {
  return date.toLocaleString("en-RW", {
    timeZone: TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-RW", {
    timeZone: TIMEZONE,
    dateStyle: "medium",
  });
}

export function formatMoney(value: number, currency = "RWF", fractionDigits = 0) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function paymentLabel(method: string) {
  return method.replaceAll("_", " ");
}
