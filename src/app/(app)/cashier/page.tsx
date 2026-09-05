import Link from "next/link";
import { PaymentMethod } from "@prisma/client";
import { requireRole } from "@/lib/auth/current-user";
import { endOfDay, formatDateTime, startOfDay } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { staffGreeting } from "@/lib/greeting";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { PaymentBadge } from "@/components/ui/Badge";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { countOpenBillsByStatus, listOpenOrdersByTable } from "@/services/orders";
import { countOutstandingCredits, listRecentPayments, sumPaymentsReceived } from "@/services/payments";

export default async function CashierHomePage() {
  const user = await requireRole("CASHIER");
  const from = startOfDay();
  const to = endOfDay();
  const [groups, billCounts, outstandingCount, cashReceivedToday, recent] = await Promise.all([
    listOpenOrdersByTable(),
    countOpenBillsByStatus(),
    countOutstandingCredits(),
    sumPaymentsReceived(from, to, PaymentMethod.CASH),
    listRecentPayments(8, from, to),
  ]);

  const openOrders = groups.flatMap((group) => group.orders);
  const stats = {
    unpaidBills: billCounts.unpaidBills,
    partialBills: billCounts.partialBills,
    payLater: outstandingCount,
    cashReceivedToday,
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zenith-muted">B-ZENITH</p>
      <h1 className="mt-1 font-display text-2xl text-zenith-gold">{staffGreeting(user.name)}</h1>
      <p className="mt-1 text-sm text-zenith-muted">Take the cash. Record the payment.</p>

      <div className="mt-4">
        <VisibleDate label="Cashier Activity" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-2xl font-semibold text-zenith-gold">{stats.unpaidBills}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Unpaid bills
          </div>
        </div>
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-2xl font-semibold text-zenith-gold">{stats.partialBills}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Partial bills
          </div>
        </div>
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-2xl font-semibold text-zenith-gold">{stats.payLater}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Customer credit
          </div>
        </div>
        <div className="rounded-xl border border-zenith-border bg-white p-3">
          <div className="text-xl font-semibold text-zenith-gold sm:text-2xl">
            {formatRwf(stats.cashReceivedToday)}
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            Cash received today
          </div>
        </div>
      </div>

      <section className="mt-6 min-w-0">
        <h2 className="font-display text-xl">Open bills</h2>
        {openOrders.length === 0 ? (
          <div className="mt-3 rounded-xl border border-zenith-border bg-white px-4 py-5">
            <p className="font-semibold">No unpaid bills right now.</p>
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {openOrders.map((order) => (
              <article key={order.id} className="min-w-0 rounded-xl border border-zenith-border bg-white p-3">
                <Link href={`/cashier/bills/${order.tableId}#order-${order.id}`} className="block min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-zenith-gold">TABLE {order.table.name}</div>
                      <div className="mt-0.5 font-semibold">Order #{order.orderNumber}</div>
                      <div className="mt-0.5 text-sm">{order.waiter.name}</div>
                    </div>
                    <PaymentBadge status={order.paymentStatus} />
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
                <div className="mt-3">
                  <PrintFactureLink href={`/print/order/${order.id}`} className="w-full" />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl">Recently paid</h2>
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zenith-border bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold">
                    Table {payment.order.table.name} · Order #{payment.order.orderNumber}
                  </div>
                  <div className="text-sm">
                    {payment.order.waiter.name} · {formatDateTime(payment.createdAt)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-lg font-semibold text-zenith-gold">{formatRwf(payment.amount)}</div>
                  <PrintFactureLink href={`/print/order/${payment.order.id}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
