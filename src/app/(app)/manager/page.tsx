import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime, startOfDay, endOfDay } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { OrderBadge, PaymentBadge } from "@/components/ui/Badge";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { listStock, listMovements } from "@/services/inventory";
import { listOrders, todayLiveOrderTotals } from "@/services/orders";
import { listRecentPayments } from "@/services/payments";

export default async function ManagerDashboardPage() {
  await requireRole("MANAGER");
  const from = startOfDay();
  const to = endOfDay();
  const [
    liveTotals,
    openOrders,
    lowStock,
    recentOrders,
    recentPayments,
    movements,
  ] = await Promise.all([
    todayLiveOrderTotals(from, to),
    listOrders({ openOnly: true, take: 20 }),
    listStock(true),
    listOrders({ take: 5 }),
    listRecentPayments(5),
    listMovements(5),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Manager Dashboard</h1>
      <div className="mt-1">
        <VisibleDate />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
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
            Paid today
          </div>
        </div>
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-xl font-semibold text-zenith-gold sm:text-2xl">{formatRwf(liveTotals.outstanding)}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Outstanding
          </div>
        </div>
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-2xl font-semibold text-zenith-gold">{lowStock.length}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Low stock
          </div>
        </div>
      </div>

      <section className="mt-6 min-w-0">
        <h2 className="font-display text-xl">Open orders</h2>
        {openOrders.length === 0 ? (
          <p className="mt-3 rounded-xl border border-zenith-border bg-white px-4 py-5 font-semibold">
            No open orders.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {openOrders.map((order) => (
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

      <section className="mt-6 grid min-w-0 gap-5 lg:grid-cols-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl">Recent orders</h2>
          <div className="mt-3 space-y-2">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/manager/orders/${order.id}`}
                className="block rounded-xl border border-zenith-border bg-white p-3"
              >
                <div className="font-semibold">
                  #{order.orderNumber} · {order.waiter.name}
                </div>
                <div className="text-sm">
                  Table {order.table.name} · {formatDateTime(order.createdAt)}
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-xl">Recent payments</h2>
          <div className="mt-3 space-y-2">
            {recentPayments.length === 0 ? <p className="text-sm">No payments yet.</p> : null}
            {recentPayments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-zenith-border bg-white p-3">
                <div className="font-semibold">
                  {formatRwf(payment.amount)} · #{payment.order.orderNumber}
                </div>
                <div className="text-sm">{formatDateTime(payment.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-xl">Recent stock</h2>
          <div className="mt-3 space-y-2">
            {movements.length === 0 ? <p className="text-sm">No stock movements yet.</p> : null}
            {movements.map((move) => (
              <div key={move.id} className="rounded-xl border border-zenith-border bg-white p-3">
                <div className="font-semibold">
                  {move.product.name} · {move.type}
                </div>
                <div className="text-sm">
                  {move.quantity > 0 ? "+" : ""}
                  {move.quantity} · {formatDateTime(move.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {lowStock.length > 0 ? (
        <section className="mt-6 min-w-0">
          <h2 className="font-display text-xl">Low stock</h2>
          <div className="mt-3 grid gap-2">
            {lowStock.slice(0, 8).map((product) => (
              <div
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zenith-border bg-white p-3"
              >
                <span className="font-semibold">{product.name}</span>
                <span className="font-semibold text-zenith-danger">
                  Main {product.main} · Bar {product.bar} · Total {product.total}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
