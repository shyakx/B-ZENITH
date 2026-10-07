import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { startOfDay, endOfDay } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { todayLiveOrderTotals } from "@/services/orders";

export default async function ManagerDashboardPage() {
  await requireRole("MANAGER");
  const from = startOfDay();
  const to = endOfDay();
  const liveTotals = await todayLiveOrderTotals(from, to);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Manager Dashboard</h1>
      <div className="mt-1">
        <VisibleDate />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-2xl font-semibold text-zenith-gold">{liveTotals.ordersToday}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Orders today
          </div>
        </div>
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-xl font-semibold text-zenith-gold sm:text-2xl">{formatRwf(liveTotals.salesToday)}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Sales today
          </div>
        </div>
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-xl font-semibold text-zenith-gold sm:text-2xl">{formatRwf(liveTotals.paidToday)}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Collected today
          </div>
        </div>
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-xl font-semibold text-zenith-gold sm:text-2xl">{formatRwf(liveTotals.outstanding)}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Still unpaid
          </div>
        </div>
      </div>

      <section className="mt-6 min-w-0">
        <div className="flex flex-wrap gap-3">
          <Link href="/manager/orders" className="rounded-xl border border-zenith-border bg-white px-4 py-3 font-semibold text-zenith-gold">
            Today&apos;s orders
          </Link>
          <Link href="/manager/reports" className="rounded-xl border border-zenith-border bg-white px-4 py-3 font-semibold text-zenith-gold">
            Reports &amp; history
          </Link>
          <Link href="/manager/inventory" className="rounded-xl border border-zenith-border bg-white px-4 py-3 font-semibold text-zenith-gold">
            Stock
          </Link>
        </div>
      </section>
    </div>
  );
}
