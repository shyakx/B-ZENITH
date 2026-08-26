import Link from "next/link";
import type { ReactNode } from "react";

export function DashboardHeader({
  kicker,
  title,
  subtitle,
  meta,
  actions,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {kicker ? <p className="bz-kicker">{kicker}</p> : null}
        <h1 className="bz-page-title">{title}</h1>
        {subtitle ? <p className="bz-subtitle">{subtitle}</p> : null}
        {meta ? <div className="mt-2 text-sm font-medium text-black">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
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
    <article className="rounded-md border border-black bg-white px-3 py-3">
      <p className="bz-label">{label}</p>
      <p className="bz-kpi">{value}</p>
      {hint ? <p className="mt-1 text-xs font-normal text-black">{hint}</p> : null}
    </article>
  );
}

export function StatGrid({ children, columns = 5 }: { children: ReactNode; columns?: 3 | 4 | 5 }) {
  const cls = columns === 3 ? "xl:grid-cols-3" : columns === 4 ? "xl:grid-cols-4" : "xl:grid-cols-5";
  return <section className={`grid grid-cols-2 gap-2 ${cls}`}>{children}</section>;
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">{children}</section>;
}

export function KpiCard({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: "attention" | "ok";
}) {
  const wrap =
    emphasis === "attention"
      ? "border-black bg-black text-[#FFD758]"
      : emphasis === "ok"
        ? "border-black bg-[#FFD758] text-black"
        : "border-black bg-white text-black";
  return (
    <article className={`rounded-md border px-3 py-2.5 ${wrap}`}>
      <p className="bz-label">{label}</p>
      <p className="bz-kpi mt-0.5">{value}</p>
      {hint ? <p className="mt-0.5 text-xs font-normal">{hint}</p> : null}
    </article>
  );
}

export function MetricRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 px-4 py-2">
      <span className="bz-label">{label}</span>
      <span className="text-right">
        <span className="font-semibold text-black">{value}</span>
        {hint ? <span className="mt-0.5 block text-xs font-normal text-black">{hint}</span> : null}
      </span>
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "stop" | "neutral" | "info";
  children: ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-[#FFD758] text-black"
      : tone === "warn"
        ? "bg-[#FFD758] text-black"
        : tone === "stop"
          ? "bg-black text-white"
          : tone === "info"
            ? "bg-black text-[#FFD758]"
            : "border border-black bg-white text-black";
  return (
    <span className={`inline-flex min-h-7 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${cls}`}>
      <span aria-hidden>●</span>
      {children}
    </span>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black px-4 py-3">
      <h2 className="bz-section-title">{title}</h2>
      {action}
    </div>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <section className="min-w-0 overflow-hidden rounded-md border border-black bg-white">{children}</section>;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="p-8 text-center">
      <p className="font-semibold text-black">{title}</p>
      {body ? <p className="mt-1 text-sm font-normal text-black">{body}</p> : null}
    </div>
  );
}

export function QuickAction({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`grid min-h-11 place-items-center rounded-md px-4 text-sm font-medium transition-transform hover:-translate-y-px active:scale-[0.98] ${
        primary ? "bg-[#FFD758] text-black" : "border border-black bg-black text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export function AttentionList({
  items,
}: {
  items: Array<{ href: string; label: string; detail: string; tone?: "warn" | "stop" }>;
}) {
  if (items.length === 0) {
    return <EmptyState title="Everything is up to date." body="No operational issues right now." />;
  }
  return (
    <ul className="divide-y divide-black">
      {items.map((item) => (
        <li key={item.href + item.label}>
          <Link href={item.href} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="font-semibold">{item.label}</span>
              <span className="mt-0.5 block text-sm font-normal text-black">{item.detail}</span>
            </span>
            <StatusBadge tone={item.tone === "stop" ? "stop" : "warn"}>{item.tone === "stop" ? "Out" : "Attention"}</StatusBadge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ActivityList({
  items,
}: {
  items: Array<{ id: string; href?: string; title: string; meta: string; badge: string; amount?: string }>;
}) {
  if (items.length === 0) return <EmptyState title="No activity yet." />;
  const row = (item: (typeof items)[number]) => (
    <div className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[1.2fr_auto_1fr_auto]">
      <p className="font-semibold">{item.title}</p>
      <span className="w-fit rounded-md bg-black px-2 py-0.5 text-[10px] font-medium text-[#FFD758]">{item.badge}</span>
      <p className="text-xs font-normal text-black">{item.meta}</p>
      {item.amount ? <p className="font-semibold">{item.amount}</p> : <span />}
    </div>
  );
  return (
    <ul className="divide-y divide-black">
      {items.map((item) => (
        <li key={item.id}>
          {item.href ? (
            <Link href={item.href} className="block">
              {row(item)}
            </Link>
          ) : (
            row(item)
          )}
        </li>
      ))}
    </ul>
  );
}
