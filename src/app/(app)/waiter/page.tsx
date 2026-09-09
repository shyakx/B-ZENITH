import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { startOfDay, endOfDay } from "@/lib/dates";
import { staffGreeting } from "@/lib/greeting";
import { formatRwf } from "@/lib/domain/money";
import { itemQuantity, waiterTodayStats } from "@/lib/waiter-dashboard";
import { PrintSlipLink } from "@/components/print/PrintFactureLink";
import { Button } from "@/components/ui/Button";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { PaymentBadge } from "@/components/ui/Badge";
import { listOrders, waiterTodaySnapshot } from "@/services/orders";

export default async function WaiterHomePage() {
  const user = await requireRole("WAITER");
  const from = startOfDay();
  const to = endOfDay();
  const [todaySnapshot, todayOrders, openOrders] = await Promise.all([
    waiterTodaySnapshot(user.id, from, to),
    listOrders({ waiterId: user.id, from, to, take: 30, withItems: true }),
    listOrders({ waiterId: user.id, openOnly: true, take: 30, withItems: true }),
  ]);
  const stats = waiterTodayStats(todaySnapshot);
  const olderOpen = openOrders.filter((order) => order.createdAt < from);
  const noOrdersToday = todayOrders.length === 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zenith-muted">B-ZENITH</p>
      <h1 className="mt-1 font-display text-2xl text-zenith-gold">{staffGreeting(user.name)}</h1>
      <div className="mt-1">
        <VisibleDate />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href="/waiter/orders/new" className="min-w-0 sm:flex-1">
          <Button className="pos-tap h-14 w-full text-base sm:h-16 sm:text-lg">+ New order</Button>
        </Link>
        <Link href="/waiter/orders" className="min-w-0 sm:w-40">
          <Button variant="secondary" className="h-12 w-full sm:h-16">
            My orders
          </Button>
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-2xl font-semibold text-zenith-gold">{stats.orderCount}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Orders today
          </div>
        </div>
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-2xl font-semibold text-zenith-gold">{openOrders.length}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Open now
          </div>
        </div>
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-2xl font-semibold text-zenith-gold">{stats.tableCount}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Tables today
          </div>
        </div>
      </div>

      {noOrdersToday ? (
        <section className="mt-6 rounded-xl border border-zenith-border bg-white px-5 py-6 text-center">
          <p className="font-display text-xl text-zenith-gold">No orders yet today</p>
          <Link href="/waiter/orders/new" className="mt-5 inline-block">
            <Button>+ New order</Button>
          </Link>
        </section>
      ) : (
        <section className="mt-8 min-w-0">
          <h2 className="font-display text-xl">Today&apos;s orders</h2>
          <div className="mt-3 grid gap-3">
            {todayOrders.map((order) => (
              <article key={order.id} className="min-w-0 rounded-xl border border-zenith-border bg-white p-3">
                <Link href={`/waiter/orders#order-${order.id}`} className="block min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-zenith-gold">ORDER #{order.orderNumber}</div>
                      <div className="mt-1 text-sm">
                        Table {order.table.name} · {itemQuantity(order)} items
                      </div>
                    </div>
                    <PaymentBadge status={order.paymentStatus} />
                  </div>
                  <div className="mt-2 text-lg font-semibold">{formatRwf(order.total)}</div>
                </Link>
                <div className="mt-3">
                  <PrintSlipLink href={`/print/slip/order/${order.id}`} className="w-full" />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {olderOpen.length > 0 ? (
        <section className="mt-8 min-w-0">
          <h2 className="font-display text-xl">Still open from earlier</h2>
          <div className="mt-3 grid gap-3">
            {olderOpen.map((order) => (
              <article key={order.id} className="min-w-0 rounded-xl border border-zenith-border bg-white p-3">
                <Link href={`/waiter/orders#order-${order.id}`} className="block min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-zenith-gold">ORDER #{order.orderNumber}</div>
                      <div className="mt-1 text-sm">
                        Table {order.table.name} · {itemQuantity(order)} items
                      </div>
                    </div>
                    <PaymentBadge status={order.paymentStatus} />
                  </div>
                  <div className="mt-2 text-lg font-semibold">{formatRwf(order.total)}</div>
                </Link>
                <div className="mt-3">
                  <PrintSlipLink href={`/print/slip/order/${order.id}`} className="w-full" />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
