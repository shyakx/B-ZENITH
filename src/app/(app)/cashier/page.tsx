import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { cashierShiftStats } from "@/lib/cashier-dashboard";
import { endOfDay, formatDateTime, startOfDay } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { staffGreeting } from "@/lib/greeting";
import { PaymentBadge } from "@/components/ui/Badge";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { listOpenOrdersByTable } from "@/services/orders";
import { listOutstanding, listPayments } from "@/services/payments";

export default async function CashierHomePage() {
  const user = await requireRole("CASHIER");
  const [groups, outstanding, payments] = await Promise.all([
    listOpenOrdersByTable(),
    listOutstanding(),
    listPayments(startOfDay(), endOfDay()),
  ]);

  const openOrders = groups.flatMap((group) => group.orders);
  const stats = cashierShiftStats(openOrders, outstanding.length, payments);
  const recent = payments.slice(0, 8);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zenith-muted">B-ZENITH</p>
      <h1 className="mt-1 font-display text-2xl text-zenith-gold sm:text-3xl">{staffGreeting(user.name)}</h1>
      <p className="mt-1 text-zenith-muted">Take the cash. Record the payment.</p>

      <div className="mt-6">
        <VisibleDate label="Cashier Activity" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-zenith-border bg-white p-4">
          <div className="font-display text-3xl text-zenith-gold">{stats.unpaidBills}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Unpaid bills
          </div>
        </div>
        <div className="rounded-2xl border border-zenith-border bg-white p-4">
          <div className="font-display text-3xl text-zenith-gold">{stats.partialBills}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Partial bills
          </div>
        </div>
        <div className="rounded-2xl border border-zenith-border bg-white p-4">
          <div className="font-display text-3xl text-zenith-gold">{stats.payLater}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Pay later
          </div>
        </div>
        <div className="rounded-2xl border border-zenith-border bg-white p-4">
          <div className="font-display text-2xl text-zenith-gold sm:text-3xl">
            {formatRwf(stats.cashReceivedToday)}
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Cash received today
          </div>
        </div>
      </div>

      <section className="mt-8 min-w-0">
        <h2 className="font-display text-2xl">Open bills</h2>
        {openOrders.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-zenith-border bg-white px-4 py-6">
            <p className="font-semibold">No unpaid bills right now.</p>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {openOrders.map((order) => (
              <Link
                key={order.id}
                href={`/cashier/bills/${order.tableId}#order-${order.id}`}
                className="block min-w-0 rounded-2xl border border-zenith-border bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-2xl text-zenith-gold">TABLE {order.table.name}</div>
                    <div className="mt-1 text-lg font-semibold">Order #{order.orderNumber}</div>
                    <div className="mt-1 text-sm">{order.waiter.name}</div>
                  </div>
                  <PaymentBadge status={order.paymentStatus} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Total</div>
                    <div className="font-semibold">{formatRwf(order.total)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Paid</div>
                    <div className="font-semibold">{formatRwf(order.paidAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Due</div>
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

      <section className="mt-8 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Recently paid</h2>
          <Link href="/cashier/payments" className="text-sm font-semibold text-zenith-gold">
            All today&apos;s payments →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-zenith-muted">No cash recorded yet today.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {recent.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zenith-border bg-white p-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold">
                    Table {payment.order.table.name} · Order #{payment.order.orderNumber}
                  </div>
                  <div className="text-sm">
                    {payment.order.waiter.name} · {formatDateTime(payment.createdAt)}
                  </div>
                </div>
                <div className="font-display text-xl text-zenith-gold">{formatRwf(payment.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
