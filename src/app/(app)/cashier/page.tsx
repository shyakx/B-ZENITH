import Link from "next/link";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth/current-user";
import { endOfDay, startOfDay } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { staffGreeting } from "@/lib/greeting";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { PaymentBadge } from "@/components/ui/Badge";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { countOpenBillsByStatus, listOpenOrdersByTable } from "@/services/orders";
import { countOutstandingCredits, sumPaymentsReceived } from "@/services/payments";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, type SearchParams } from "@/lib/list-filters";

export default async function CashierHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole("CASHIER");
  const params = await searchParams;
  const search = singleParam(params, "q");
  const { from, to, fromValue, toValue } = dateRange(params);
  const todayFrom = startOfDay();
  const todayTo = endOfDay();
  const paymentStatus = [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID].find(
    (value) => value === singleParam(params, "paymentStatus"),
  );
  const [groups, billCounts, outstandingCount, cashReceivedToday] = await Promise.all([
    listOpenOrdersByTable({ from, to, search, paymentStatus }),
    countOpenBillsByStatus(),
    countOutstandingCredits(),
    sumPaymentsReceived(todayFrom, todayTo, PaymentMethod.CASH),
  ]);

  const openOrders = groups.flatMap((group) => group.orders);
  const stats = {
    unpaidBills: billCounts.unpaidBills,
    partialBills: billCounts.partialBills,
    payLater: outstandingCount,
    cashReceivedToday,
  };
  const filterFields: ListFilterField[] = [
    { name: "from", label: "Order from", type: "date", value: fromValue },
    { name: "to", label: "Order to", type: "date", value: toValue },
    { name: "q", label: "Search bills", type: "search", value: search, placeholder: "Order, waiter, or table" },
    {
      name: "paymentStatus",
      label: "Payment status",
      type: "select",
      value: paymentStatus ?? "",
      options: [
        { value: "", label: "All open bills" },
        { value: PaymentStatus.UNPAID, label: "Unpaid" },
        { value: PaymentStatus.PARTIALLY_PAID, label: "Partially paid" },
      ],
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zenith-muted">B-ZENITH</p>
      <h1 className="mt-1 font-display text-2xl text-zenith-gold">{staffGreeting(user.name)}</h1>
      <div className="mt-1">
        <VisibleDate />
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
            Cash today
          </div>
        </div>
      </div>

      <section className="mt-6 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl">Open bills</h2>
          <Link href="/cashier/payments" className="text-sm font-semibold text-zenith-gold">
            Today&apos;s payments →
          </Link>
        </div>
        <div className="mt-4">
          <ListFilterForm fields={filterFields} action="/cashier" />
        </div>
        <p className="mb-2 text-xs text-zenith-muted">
          {openOrders.length} matching open bills. Outstanding bill and credit counts above include earlier days; cash is for today.
        </p>
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
    </div>
  );
}
