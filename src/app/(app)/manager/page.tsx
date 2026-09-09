import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime, startOfDay, endOfDay } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { OrderBadge, PaymentBadge } from "@/components/ui/Badge";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { listOrders, todayLiveOrderTotals } from "@/services/orders";

export default async function ManagerDashboardPage() {
  await requireRole("MANAGER");
  const from = startOfDay();
  const to = endOfDay();
  const [liveTotals, todayOrders] = await Promise.all([
    todayLiveOrderTotals(from, to),
    listOrders({ from, to, take: 20 }),
  ]);

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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl">Today&apos;s orders</h2>
          <Link href="/manager/orders" className="text-sm font-semibold text-zenith-gold">
            Today&apos;s orders →
          </Link>
        </div>
        {todayOrders.length === 0 ? (
          <p className="mt-3 rounded-xl border border-zenith-border bg-white px-4 py-5 font-semibold">
            No orders yet today.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {todayOrders.map((order) => (
              <Link
                key={order.id}
                href={`/manager/orders/${order.id}`}
                className="block min-w-0 rounded-xl border border-zenith-border bg-white p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-zenith-gold">#{order.orderNumber}</div>
                    <div className="mt-0.5 text-sm">
                      Table {order.table.name} · {order.waiter.name}
                    </div>
                    <div className="text-sm">{formatDateTime(order.createdAt)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <OrderBadge status={order.status} />
                    <PaymentBadge status={order.paymentStatus} />
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Total</div>
                    <div className="font-semibold">{formatRwf(order.total)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Paid</div>
                    <div className="font-semibold">{formatRwf(order.paidAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Balance</div>
                    <div className="font-semibold text-zenith-gold">
                      {formatRwf(order.total - order.paidAmount)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
        <Link href="/manager/reports" className="text-zenith-gold">
          Reports & history →
        </Link>
        <Link href="/manager/inventory" className="text-zenith-gold">
          Stock →
        </Link>
      </p>
    </div>
  );
}
