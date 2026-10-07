import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatRwf } from "@/lib/domain/money";
import { combinedBill } from "@/lib/domain/payments";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { PaymentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, validAmountParam, type SearchParams } from "@/lib/list-filters";
import { PaymentStatus } from "@prisma/client";
import { listOpenOrdersByTable } from "@/services/orders";
import { listTables } from "@/services/products";
import { listUsers } from "@/services/users";

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("CASHIER");
  const params = await searchParams;
  const { from, to, fromValue, toValue } = dateRange(params);
  const paymentStatus = [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID].find(
    (value) => value === singleParam(params, "paymentStatus"),
  );
  const search = singleParam(params, "q");
  const tableId = singleParam(params, "tableId");
  const waiterId = singleParam(params, "waiterId");
  const minBalance = validAmountParam(singleParam(params, "minBalance"));
  const maxBalance = validAmountParam(singleParam(params, "maxBalance"));
  const [groups, tables, users] = await Promise.all([
    listOpenOrdersByTable({ from, to, paymentStatus, search, tableId, waiterId, minBalance, maxBalance }),
    listTables(),
    listUsers(),
  ]);
  const fields: ListFilterField[] = [
    { name: "from", label: "Order from", type: "date", value: fromValue },
    { name: "to", label: "Order to", type: "date", value: toValue },
    { name: "q", label: "Search", type: "search", value: search, placeholder: "Order, waiter, or table" },
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
    {
      name: "tableId",
      label: "Table",
      type: "select",
      value: tableId,
      options: [{ value: "", label: "All tables" }, ...tables.map((table) => ({ value: table.id, label: table.name }))],
    },
    {
      name: "waiterId",
      label: "Waiter",
      type: "select",
      value: waiterId,
      options: [{ value: "", label: "All waiters" }, ...users.filter((user) => user.role === "WAITER").map((user) => ({ value: user.id, label: user.name }))],
    },
    { name: "minBalance", label: "Min order balance", type: "number", value: singleParam(params, "minBalance") },
    { name: "maxBalance", label: "Max order balance", type: "number", value: singleParam(params, "maxBalance") },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Orders / Bills</h1>

      <div className="mt-5">
        <ListFilterForm fields={fields} action="/cashier/bills" />
      </div>
      <p className="mb-2 text-xs text-zenith-muted">{groups.length} tables with matching open bills.</p>
      <div className="mt-6 space-y-4">
        {groups.length === 0 ? (
          <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
            No open bills.
          </p>
        ) : null}
        {groups.map((group) => {
          const bill = combinedBill(group.orders);
          return (
            <article key={group.tableId} className="min-w-0 rounded-xl border border-zenith-border bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl text-zenith-gold">TABLE {group.tableName}</h2>
                <PaymentBadge status={bill.status} />
              </div>
              <div className="space-y-2">
                {group.orders.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <span>
                      Order #{order.orderNumber} — {order.waiter.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{formatRwf(order.total)}</span>
                      <PrintFactureLink href={`/print/order/${order.id}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zenith-border pt-4 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">
                    Table total
                  </div>
                  <div className="text-lg font-semibold">{formatRwf(bill.total)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Paid</div>
                  <div className="text-lg font-semibold">{formatRwf(bill.paid)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">
                    Balance
                  </div>
                  <div className="text-lg font-semibold text-zenith-gold">{formatRwf(bill.remaining)}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/cashier/bills/${group.tableId}`}>
                  <Button>Open bill</Button>
                </Link>
                <PrintFactureLink href={`/print/table/${group.tableId}`} label="Print table facture" />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
