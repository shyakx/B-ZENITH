import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { PaymentBadge } from "@/components/ui/Badge";
import { listOrders } from "@/services/orders";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, validAmountParam, type SearchParams } from "@/lib/list-filters";
import { listTables } from "@/services/products";
import { listUsers } from "@/services/users";

export default async function FacturesPage({
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
  const status = Object.values(OrderStatus).find((value) => value === singleParam(params, "status"));
  const paymentStatus = Object.values(PaymentStatus).find(
    (value) => value === singleParam(params, "paymentStatus"),
  );
  const minTotal = validAmountParam(singleParam(params, "minTotal"));
  const maxTotal = validAmountParam(singleParam(params, "maxTotal"));
  const [orders, tables, users] = await Promise.all([
    listOrders({ take: 200, from, to, search, tableId, waiterId, status, paymentStatus, minTotal, maxTotal }),
    listTables(),
    listUsers(),
  ]);
  const fields: ListFilterField[] = [
    { name: "from", label: "From", type: "date", value: fromValue },
    { name: "to", label: "To", type: "date", value: toValue },
    { name: "q", label: "Search", type: "search", value: search, placeholder: "Order, waiter, table, item" },
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
    {
      name: "status",
      label: "Order status",
      type: "select",
      value: status ?? "",
      options: [{ value: "", label: "All statuses" }, ...Object.values(OrderStatus).map((value) => ({ value, label: value.replaceAll("_", " ") }))],
    },
    {
      name: "paymentStatus",
      label: "Payment",
      type: "select",
      value: paymentStatus ?? "",
      options: [{ value: "", label: "All payments" }, ...Object.values(PaymentStatus).map((value) => ({ value, label: value.replaceAll("_", " ") }))],
    },
    { name: "minTotal", label: "Min total", type: "number", value: singleParam(params, "minTotal") },
    { name: "maxTotal", label: "Max total", type: "number", value: singleParam(params, "maxTotal") },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Factures</h1>

      <div className="mt-5">
        <ListFilterForm fields={fields} action="/cashier/factures" />
      </div>
      <p className="mb-2 text-xs text-zenith-muted">{orders.length} orders shown (maximum 200).</p>
      <div className="mt-6 space-y-3">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
            No orders match these dates and filters.
          </p>
        ) : null}
        {orders.map((order) => (
          <article
            key={order.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zenith-border bg-white p-4"
          >
            <div className="min-w-0">
              <div className="font-semibold">Order #{order.orderNumber}</div>
              <div className="text-sm">
                Table {order.table.name} · {order.waiter.name}
              </div>
              <div className="text-sm text-zenith-muted">{formatDateTime(order.createdAt)}</div>
              <div className="mt-2">
                <PaymentBadge status={order.paymentStatus} />
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="font-display text-xl text-zenith-gold">{formatRwf(order.total)}</div>
              <PrintFactureLink href={`/print/order/${order.id}`} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
