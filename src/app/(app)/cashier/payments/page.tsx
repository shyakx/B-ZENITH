import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { VisibleDateRange } from "@/components/ui/VisibleDate";
import { listPayments } from "@/services/payments";
import { PaymentMethod } from "@prisma/client";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, validAmountParam, type SearchParams } from "@/lib/list-filters";
import { listUsers } from "@/services/users";
import { listTables } from "@/services/products";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("CASHIER");
  const params = await searchParams;
  const { from, to, fromValue, toValue } = dateRange(params);
  const method = Object.values(PaymentMethod).find((value) => value === singleParam(params, "method"));
  const cashierId = singleParam(params, "cashierId");
  const waiterId = singleParam(params, "waiterId");
  const tableId = singleParam(params, "tableId");
  const search = singleParam(params, "q");
  const minAmount = validAmountParam(singleParam(params, "minAmount"));
  const maxAmount = validAmountParam(singleParam(params, "maxAmount"));
  const [payments, users, tables] = await Promise.all([
    listPayments(from, to, { method, cashierId, waiterId, tableId, search, minAmount, maxAmount }),
    listUsers(),
    listTables(),
  ]);
  const cashToday = payments
    .filter((payment) => payment.method === "CASH")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const fields: ListFilterField[] = [
    { name: "from", label: "From", type: "date", value: fromValue },
    { name: "to", label: "To", type: "date", value: toValue },
    { name: "q", label: "Search", type: "search", value: search, placeholder: "Order, cashier, waiter, table" },
    {
      name: "method",
      label: "Method",
      type: "select",
      value: method ?? "",
      options: [{ value: "", label: "All methods" }, ...Object.values(PaymentMethod).map((value) => ({ value, label: value.replaceAll("_", " ") }))],
    },
    {
      name: "cashierId",
      label: "Cashier",
      type: "select",
      value: cashierId,
      options: [{ value: "", label: "All cashiers" }, ...users.filter((user) => user.role === "CASHIER").map((user) => ({ value: user.id, label: user.name }))],
    },
    {
      name: "waiterId",
      label: "Waiter",
      type: "select",
      value: waiterId,
      options: [{ value: "", label: "All waiters" }, ...users.filter((user) => user.role === "WAITER").map((user) => ({ value: user.id, label: user.name }))],
    },
    {
      name: "tableId",
      label: "Table",
      type: "select",
      value: tableId,
      options: [{ value: "", label: "All tables" }, ...tables.map((table) => ({ value: table.id, label: table.name }))],
    },
    { name: "minAmount", label: "Min amount", type: "number", value: singleParam(params, "minAmount") },
    { name: "maxAmount", label: "Max amount", type: "number", value: singleParam(params, "maxAmount") },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Payments</h1>
      <div className="mt-2">
        <VisibleDateRange from={from} to={to} />
      </div>
      <div className="mt-5">
        <ListFilterForm fields={fields} action="/cashier/payments" />
      </div>
      <p className="mt-4 font-display text-2xl text-zenith-gold">{formatRwf(cashToday)} cash in results</p>
      <p className="mt-1 text-xs text-zenith-muted">{payments.length} payments shown.</p>

      <div className="mt-6 space-y-3">
        {payments.length === 0 ? (
          <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
            No payments on this date.
          </p>
        ) : null}
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zenith-border bg-white p-4"
          >
            <div className="min-w-0">
              <div className="font-semibold">
                Table {payment.order.table.name} · Order #{payment.order.orderNumber}
              </div>
              <div className="text-sm">
                {payment.order.waiter.name} · {payment.cashier.name}
              </div>
              <div className="text-sm font-semibold">{formatDateTime(payment.createdAt)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-display text-xl text-zenith-gold">{formatRwf(payment.amount)}</div>
              <PrintFactureLink href={`/print/order/${payment.order.id}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
