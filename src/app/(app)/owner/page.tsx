import { requireRole } from "@/lib/auth/current-user";
import { staffControlCounts } from "@/lib/admin-control";
import { formatRwf } from "@/lib/domain/money";
import { endOfDay, startOfDay } from "@/lib/dates";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { listStock } from "@/services/inventory";
import { todayLiveOrderTotals } from "@/services/orders";
import { listUsers } from "@/services/users";

function CountCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zenith-border bg-white p-3">
      <div className="text-xl font-semibold text-zenith-gold">{value}</div>
      <div className="mt-1 text-xs font-medium text-zenith-muted">{label}</div>
    </div>
  );
}

export default async function OwnerHomePage() {
  await requireRole("OWNER");
  const from = startOfDay();
  const to = endOfDay();
  const [liveTotals, lowStock, staff] = await Promise.all([
    todayLiveOrderTotals(from, to),
    listStock(true),
    listUsers(),
  ]);
  const counts = staffControlCounts(staff);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Business overview</h1>
      <div className="mt-1">
        <VisibleDate />
      </div>
      <p className="mt-3 text-sm">
        Owner view of the whole business. Daily till work can still be done by a cashier.
      </p>

      <section className="mt-6">
        <h2 className="text-base font-semibold">Today</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-5">
          <CountCard label="Orders today" value={liveTotals.ordersToday} />
          <CountCard label="Sales today" value={formatRwf(liveTotals.salesToday)} />
          <CountCard label="Paid today" value={formatRwf(liveTotals.paidToday)} />
          <CountCard label="Outstanding" value={formatRwf(liveTotals.outstanding)} />
          <CountCard label="Low stock" value={lowStock.length} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Staff</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <CountCard label="Owners" value={counts.owners} />
          <CountCard label="Admins" value={counts.admins} />
          <CountCard label="Managers" value={counts.managers} />
          <CountCard label="Cashiers" value={counts.cashiers} />
          <CountCard label="Waiters" value={counts.waiters} />
        </div>
      </section>
    </div>
  );
}
