import { formatDate, formatReportRange } from "@/lib/dates";

export function VisibleDate({
  label,
  date = new Date(),
}: {
  label?: string;
  date?: Date | string;
}) {
  return (
    <div>
      {label ? <p className="text-sm font-semibold text-zenith-muted">{label}</p> : null}
      <p className="mt-0.5 font-semibold text-zenith-gold">{formatDate(date)}</p>
    </div>
  );
}

export function VisibleDateRange({
  label = "Report date",
  from,
  to,
}: {
  label?: string;
  from: Date;
  to: Date;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-zenith-muted">{label}</p>
      <p className="mt-0.5 font-semibold text-zenith-gold">{formatReportRange(from, to)}</p>
    </div>
  );
}
