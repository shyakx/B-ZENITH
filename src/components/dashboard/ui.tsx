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
        {kicker ? <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">{kicker}</p> : null}
        <h1 className="text-3xl font-black tracking-tight text-stone-950 md:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm font-medium text-stone-600">{subtitle}</p> : null}
        {meta ? <div className="mt-2 text-sm font-bold text-stone-700">{meta}</div> : null}
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
    <article className="rounded-lg border border-stone-300 bg-white px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-stone-950">{value}</p>
      {hint ? <p className="mt-1 text-xs font-medium text-stone-500">{hint}</p> : null}
    </article>
  );
}

export function StatGrid({ children, columns = 5 }: { children: ReactNode; columns?: 3 | 4 | 5 }) {
  const cls = columns === 3 ? "xl:grid-cols-3" : columns === 4 ? "xl:grid-cols-4" : "xl:grid-cols-5";
  return <section className={`grid grid-cols-2 gap-2 ${cls}`}>{children}</section>;
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">{children}</section>;
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
      ? "border-amber-500 bg-black text-[#d4af37]"
      : emphasis === "ok"
        ? "border-emerald-700 bg-white"
        : "border-stone-300 bg-white";
  const labelCls = emphasis === "attention" ? "text-[#d4af37]" : "text-stone-500";
  const valueCls = emphasis === "attention" ? "text-[#d4af37]" : "text-stone-950";
  const hintCls = emphasis === "attention" ? "text-[#d4af37]/80" : "text-stone-500";
  return (
    <article className={`rounded-lg border px-3 py-2.5 ${wrap}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest ${labelCls}`}>{label}</p>
      <p className={`mt-0.5 text-2xl font-black leading-tight ${valueCls}`}>{value}</p>
      {hint ? <p className={`mt-0.5 text-xs font-medium ${hintCls}`}>{hint}</p> : null}
    </article>
  );
}

export function MetricRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 px-4 py-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{label}</span>
      <span className="text-right">
        <span className="font-black text-stone-950">{value}</span>
        {hint ? <span className="mt-0.5 block text-xs font-medium text-stone-500">{hint}</span> : null}
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
      ? "bg-emerald-700 text-white"
      : tone === "warn"
        ? "bg-amber-500 text-black"
        : tone === "stop"
          ? "bg-stone-900 text-white"
          : tone === "info"
            ? "bg-black text-[#d4af37]"
            : "bg-stone-200 text-stone-800";
  return (
    <span className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${cls}`}>
      <span aria-hidden>●</span>
      {children}
    </span>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
      <h2 className="text-sm font-black uppercase tracking-widest text-stone-700">{title}</h2>
      {action}
    </div>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <section className="min-w-0 overflow-hidden rounded-lg border border-stone-300 bg-white">{children}</section>;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="p-8 text-center">
      <p className="font-black text-stone-800">{title}</p>
      {body ? <p className="mt-1 text-sm text-stone-500">{body}</p> : null}
    </div>
  );
}

export function QuickAction({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`grid min-h-11 place-items-center rounded-md px-4 font-bold ${
        primary ? "bg-black text-[#d4af37]" : "border border-stone-400 bg-white"
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
    <ul className="divide-y">
      {items.map((item) => (
        <li key={item.href + item.label}>
          <Link href={item.href} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="font-black">{item.label}</span>
              <span className="mt-0.5 block text-sm text-stone-600">{item.detail}</span>
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
      <p className="font-black">{item.title}</p>
      <span className="w-fit rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-black text-[#d4af37]">{item.badge}</span>
      <p className="text-xs text-stone-500">{item.meta}</p>
      {item.amount ? <p className="font-black">{item.amount}</p> : <span />}
    </div>
  );
  return (
    <ul className="divide-y">
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
