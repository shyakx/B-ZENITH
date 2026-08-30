import { requireRole } from "@/lib/auth/current-user";
import { formatRwf } from "@/lib/domain/money";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { todaySummary } from "@/services/reports";

export default async function SalesPage() {
  await requireRole("MANAGER");
  const summary = await todaySummary();

  return (
    <div>
      <PageHeader title="Sales" subtitle="Orders, waiters and cashier activity for this date." />
      <div className="mb-4">
        <VisibleDate label="Sales Report" />
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Orders" value={String(summary.orderCount)} />
        <StatCard label="Sales" value={formatRwf(summary.orderTotal)} />
        <StatCard label="Collected" value={formatRwf(summary.collected)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zenith-border bg-zenith-card p-5">
          <h2 className="mb-3 font-display text-2xl">Waiter performance</h2>
          {summary.waiters.map((waiter) => (
            <div key={waiter.name} className="mb-2 flex justify-between text-sm">
              <span>
                {waiter.name} · {waiter.orders} orders
              </span>
              <span className="text-zenith-gold">{formatRwf(waiter.total)}</span>
            </div>
          ))}
        </section>
        <section className="rounded-2xl border border-zenith-border bg-zenith-card p-5">
          <h2 className="mb-3 font-display text-2xl">Cashier activity</h2>
          {summary.cashiers.map((cashier) => (
            <div key={cashier.name} className="mb-2 flex justify-between text-sm">
              <span>
                {cashier.name} · {cashier.payments} payments
              </span>
              <span className="text-zenith-gold">{formatRwf(cashier.total)}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
