import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { requireRole } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { SettleCreditButton } from "@/components/cashier/SettleCreditButton";
import { PaymentBadge } from "@/components/ui/Badge";
import { listOutstanding } from "@/services/payments";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, validAmountParam, type SearchParams } from "@/lib/list-filters";
import { listTables } from "@/services/products";
import { listUsers } from "@/services/users";

export default async function OutstandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("CASHIER");
  const params = await searchParams;
  const { from, to, fromValue, toValue } = dateRange(params);
  const search = singleParam(params, "q");
  const tableId = singleParam(params, "tableId");
  const waiterId = singleParam(params, "waiterId");
  const minAmount = validAmountParam(singleParam(params, "minAmount"));
  const maxAmount = validAmountParam(singleParam(params, "maxAmount"));
  const [credits, tables, users] = await Promise.all([
    listOutstanding({ from, to, search, tableId, waiterId, minAmount, maxAmount }),
    listTables(),
    listUsers(),
  ]);
  const fields: ListFilterField[] = [
    { name: "q", label: "Search", type: "search", value: search, placeholder: "Customer, phone, order, waiter" },
    { name: "from", label: "Pay-later recorded from", type: "date", value: fromValue },
    { name: "to", label: "Pay-later recorded to", type: "date", value: toValue },
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
    { name: "minAmount", label: "Min owed", type: "number", value: singleParam(params, "minAmount") },
    { name: "maxAmount", label: "Max owed", type: "number", value: singleParam(params, "maxAmount") },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Customer credit</h1>

      <div className="mt-5">
        <ListFilterForm fields={fields} action="/cashier/outstanding" />
      </div>
      <p className="mb-2 text-xs text-zenith-muted">{credits.length} outstanding credits.</p>
      <div className="mt-6 space-y-3">
        {credits.length === 0 ? (
          <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
            No customer credit matches these dates and filters.
          </p>
        ) : null}
        {credits.map((credit) => (
          <article key={credit.id} className="rounded-2xl border border-zenith-border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display text-2xl text-zenith-gold">{credit.customerName}</div>
                {credit.customerPhone ? <div className="mt-1 text-base">{credit.customerPhone}</div> : null}
                <div className="mt-2 text-base">Order #{credit.order.orderNumber}</div>
                <div className="text-base">Table {credit.order.table.name}</div>
                <div className="text-base">Waiter {credit.order.waiter.name}</div>
                <div className="mt-3 space-y-1 text-sm">
                  <div>Order: {formatDate(credit.order.createdAt)}</div>
                  <div>Pay later recorded: {formatDate(credit.createdAt)}</div>
                </div>
                <div className="mt-2">
                  <PaymentBadge status="PAY_LATER" />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">
                  Amount owed
                </div>
                <div className="font-display text-2xl text-zenith-gold">{formatRwf(credit.amountOwed)}</div>
                <div className="mt-3 flex flex-col items-end gap-2">
                  <PrintFactureLink href={`/print/order/${credit.order.id}`} />
                  <SettleCreditButton
                    creditId={credit.id}
                    amountOwed={credit.amountOwed}
                    customerName={credit.customerName}
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
