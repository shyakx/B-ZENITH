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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl text-zenith-cream">{title}</h1>
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
    <div className="rounded-2xl border border-zenith-border bg-zenith-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">{label}</div>
      <div className="mt-2 font-display text-3xl text-zenith-gold">{value}</div>
      {hint ? <div className="mt-1 text-sm text-zenith-muted">{hint}</div> : null}
    </div>
  );
}
