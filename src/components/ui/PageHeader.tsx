export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-zenith-gold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-zenith-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zenith-border bg-zenith-card p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zenith-gold">{value}</div>
      {hint ? <div className="mt-1 text-sm text-zenith-muted">{hint}</div> : null}
    </div>
  );
}
