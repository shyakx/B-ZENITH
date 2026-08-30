import { requireRole } from "@/lib/auth/current-user";
import { endOfDay, parseDateInput, startOfDay, toDateInput } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { currentOutstandingAmount } from "@/lib/manager-dashboard";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { VisibleDateRange } from "@/components/ui/VisibleDate";
import { listOpenOrdersByTable } from "@/services/orders";
import { listOutstanding } from "@/services/payments";
import { salesSummary } from "@/services/reports";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("MANAGER");
  const params = await searchParams;
  const from = params.from ? parseDateInput(params.from) : startOfDay();
  const to = params.to ? endOfDay(params.to) : endOfDay();
  const [summary, outstandingCredits, openGroups] = await Promise.all([
    salesSummary(from, to),
    listOutstanding(),
    listOpenOrdersByTable(),
  ]);
  const outstanding = currentOutstandingAmount(
    openGroups.flatMap((group) => group.orders),
    outstandingCredits,
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <PageHeader title="Sales Report" subtitle="Order dates and payment dates stay separate." />
      <div className="mb-4">
        <VisibleDateRange from={from} to={to} />
      </div>
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">From</span>
          <input
            type="date"
            name="from"
            defaultValue={toDateInput(from)}
            className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">To</span>
          <input
            type="date"
            name="to"
            defaultValue={toDateInput(to)}
            className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
          />
        </label>
        <button className="rounded-xl bg-zenith-gold px-4 py-2 font-semibold text-white">Apply</button>
      </form>
      <div className="mb-6 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales (orders created)" value={formatRwf(summary.orderTotal)} hint={`${summary.orderCount} orders`} />
        <StatCard label="Payments received" value={formatRwf(summary.collected)} />
        <StatCard label="Paid order value" value={formatRwf(summary.paidSales)} />
        <StatCard label="Outstanding now" value={formatRwf(outstanding)} />
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-zenith-border bg-white p-5">
          <h2 className="mb-3 font-display text-2xl">Product sales</h2>
          {summary.products.slice(0, 15).map((product) => (
            <div key={product.name} className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {product.name} × {product.quantity}
              </span>
              <span className="font-semibold">{formatRwf(product.total)}</span>
            </div>
          ))}
        </section>
        <section className="min-w-0 rounded-2xl border border-zenith-border bg-white p-5">
          <h2 className="mb-3 font-display text-2xl">Waiters</h2>
          {summary.waiters.map((waiter) => (
            <div key={waiter.name} className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {waiter.name} · {waiter.orders} orders
              </span>
              <span className="font-semibold">{formatRwf(waiter.total)}</span>
            </div>
          ))}
        </section>
        <section className="min-w-0 rounded-2xl border border-zenith-border bg-white p-5">
          <h2 className="mb-3 font-display text-2xl">Payments by cashier</h2>
          {summary.cashiers.map((cashier) => (
            <div key={cashier.name} className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {cashier.name} · {cashier.payments} payments
              </span>
              <span className="font-semibold">{formatRwf(cashier.total)}</span>
            </div>
          ))}
          {summary.cashiers.length === 0 ? <p className="text-sm">No payments in this date range.</p> : null}
        </section>
        <section className="min-w-0 rounded-2xl border border-zenith-border bg-white p-5">
          <h2 className="mb-3 font-display text-2xl">Outstanding pay later</h2>
          {outstandingCredits.map((credit) => (
            <div key={credit.id} className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {credit.customerName} · Order #{credit.order.orderNumber}
              </span>
              <span className="font-semibold">{formatRwf(credit.amountOwed)}</span>
            </div>
          ))}
          {outstandingCredits.length === 0 ? <p className="text-sm">None.</p> : null}
        </section>
      </div>
    </div>
  );
}
