export const BUSINESS_TIMEZONE = "Africa/Kigali";

type RwandaParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function asDate(date: Date | string): Date {
  return typeof date === "string" ? new Date(date) : date;
}

function rwandaParts(date: Date): RwandaParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const actual = rwandaParts(new Date(guess));
  const desired = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const shown = Date.UTC(
    actual.year,
    actual.month - 1,
    actual.day,
    actual.hour,
    actual.minute,
    actual.second,
    0,
  );
  return new Date(guess + (desired - shown));
}

export function getRwandaDate(date: Date | string = new Date()): string {
  const parts = rwandaParts(asDate(date));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function parseDateInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return startOfDay(new Date(value));
  }
  return zonedLocalToUtc(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function startOfDay(date: Date | string = new Date()): Date {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return parseDateInput(date);
  }
  const parts = rwandaParts(asDate(date));
  return zonedLocalToUtc(parts.year, parts.month, parts.day);
}

export function endOfDay(date: Date | string = new Date()): Date {
  const start = startOfDay(date);
  const parts = rwandaParts(start);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextStart = zonedLocalToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  );
  return new Date(nextStart.getTime() - 1);
}

export function rwandaDayRange(date: Date | string = new Date()) {
  const from = startOfDay(date);
  const to = endOfDay(date);
  return { from, to, key: getRwandaDate(from), label: formatDate(from) };
}

export function formatDate(date: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(asDate(date));
}

export function formatDateTime(date: Date | string): string {
  const value = asDate(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
  return `${formatDate(value)} · ${time}`;
}

export function formatReportRange(from: Date, to: Date): string {
  const start = formatDate(from);
  const end = formatDate(to);
  return start === end ? start : `${start} – ${end}`;
}

export function toDateInput(date: Date | string = new Date()): string {
  return getRwandaDate(date);
}

export function isOnRwandaDate(date: Date | string, day: Date | string): boolean {
  return getRwandaDate(date) === getRwandaDate(day);
}
