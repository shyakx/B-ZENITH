import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime, startOfDay, endOfDay } from "@/lib/dates";
import { staffGreeting } from "@/lib/greeting";
import { formatRwf } from "@/lib/domain/money";
import { itemQuantity, waiterTodayStats } from "@/lib/waiter-dashboard";
import { Button } from "@/components/ui/Button";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { OrderBadge, PaymentBadge } from "@/components/ui/Badge";
import { listOrders } from "@/services/orders";

export default async function WaiterHomePage() {
  const user = await requireRole("WAITER");
  const from = startOfDay();
  const to = endOfDay();
  const [todayOrders, openOrders, recentOrders] = await Promise.all([
    listOrders({ waiterId: user.id, from, to }),
    listOrders({ waiterId: user.id, openOnly: true, take: 30 }),
    listOrders({ waiterId: user.id, take: 5 }),
  ]);
  const stats = waiterTodayStats(todayOrders);
  const noOrdersToday = todayOrders.length === 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zenith-muted">B-ZENITH</p>
      <h1 className="mt-1 font-display text-2xl text-zenith-gold sm:text-3xl">{staffGreeting(user.name)}</h1>
      <p className="mt-1 text-zenith-muted">Ready to take the next order?</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href="/waiter/orders/new" className="min-w-0 sm:flex-1">
          <Button className="h-16 w-full text-lg sm:h-20 sm:text-xl">+ New order</Button>
        </Link>
        <Link href="/waiter/orders" className="min-w-0 sm:w-44">
          <Button variant="secondary" className="h-14 w-full sm:h-20">
            My orders
          </Button>
        </Link>
      </div>

      <div className="mt-6">
        <VisibleDate label="Your Activity" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-zenith-border bg-white p-4">
          <div className="font-display text-3xl text-zenith-gold">{stats.orderCount}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Today&apos;s orders
          </div>
        </div>
        <div className="rounded-2xl border border-zenith-border bg-white p-4">
          <div className="font-display text-3xl text-zenith-gold">{openOrders.length}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Open orders
          </div>
        </div>
        <div className="rounded-2xl border border-zenith-border bg-white p-4">
          <div className="font-display text-3xl text-zenith-gold">{stats.tableCount}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Tables served
          </div>
        </div>
        <div className="rounded-2xl border border-zenith-border bg-white p-4">
          <div className="font-display text-3xl text-zenith-gold">{stats.itemCount}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Items ordered
          </div>
        </div>
      </div>

      {noOrdersToday ? (
        <section className="mt-8 rounded-3xl border border-zenith-border bg-white px-5 py-8 text-center">
          <p className="font-display text-2xl text-zenith-gold">No orders yet today</p>
          <p className="mt-2 text-zenith-muted">Ready to serve your first table?</p>
          <Link href="/waiter/orders/new" className="mt-5 inline-block">
            <Button>+ New order</Button>
          </Link>
        </section>
      ) : null}

      <section className="mt-8 min-w-0">
        <h2 className="font-display text-2xl">My open orders</h2>
        {openOrders.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-zenith-border bg-white px-4 py-6">
            <p className="font-semibold">
              {noOrdersToday ? "No open orders" : "All your orders are complete"}
            </p>
            <Link href="/waiter/orders/new" className="mt-3 inline-block">
              <Button variant="secondary">Start a new order</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {openOrders.map((order) => (
              <Link
                key={order.id}
                href={`/waiter/orders#order-${order.id}`}
                className="block min-w-0 rounded-2xl border border-zenith-border bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-2xl text-zenith-gold">ORDER #{order.orderNumber}</div>
                    <div className="mt-1 text-sm">
                      Table {order.table.name} · {itemQuantity(order)} items
                    </div>
                  </div>
                  <PaymentBadge status={order.paymentStatus} />
                </div>
                <div className="mt-2 text-lg font-semibold">{formatRwf(order.total)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 min-w-0">
        <h2 className="font-display text-2xl">Tables served today</h2>
        <p className="mt-1 text-sm text-zenith-muted">Tables where you submitted an order today. Anyone can serve these tables.</p>
        {stats.tableNames.length === 0 ? (
          <p className="mt-3 text-zenith-muted">No tables yet today.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.tableNames.map((name) => (
              <span
                key={name}
                className="inline-flex min-h-11 items-center rounded-full border border-zenith-border bg-white px-4 py-2 text-sm font-semibold"
              >
                Table {name}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Recent orders</h2>
          <Link href="/waiter/orders" className="text-sm font-semibold text-zenith-gold">
            View my orders →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="mt-3 text-zenith-muted">No orders yet.</p>
        ) : (
          <>
            <div className="mt-3 hidden min-w-0 overflow-x-hidden md:block">
              <table className="w-full min-w-0 text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">
                    <th className="py-2 pr-3 font-semibold">Order</th>
                    <th className="py-2 pr-3 font-semibold">Table</th>
                    <th className="py-2 pr-3 font-semibold">Time</th>
                    <th className="py-2 pr-3 font-semibold">Items</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-zenith-border">
                      <td className="py-2.5 pr-3 font-semibold">#{order.orderNumber}</td>
                      <td className="py-2.5 pr-3">Table {order.table.name}</td>
                      <td className="py-2.5 pr-3">{formatDateTime(order.createdAt)}</td>
                      <td className="py-2.5 pr-3">{itemQuantity(order)}</td>
                      <td className="py-2.5">
                        <OrderBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid gap-2 md:hidden">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/waiter/orders#order-${order.id}`}
                  className="rounded-2xl border border-zenith-border bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-display text-xl text-zenith-gold">#{order.orderNumber}</div>
                    <OrderBadge status={order.status} />
                  </div>
                  <div className="mt-1 text-sm">
                    Table {order.table.name} · {formatDateTime(order.createdAt)} · {itemQuantity(order)} items
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
