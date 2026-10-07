import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { OrderBadge, PaymentBadge } from "@/components/ui/Badge";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, validAmountParam, type SearchParams } from "@/lib/list-filters";
import { listOrders } from "@/services/orders";
import { listTables } from "@/services/products";
import { listUsers } from "@/services/users";

export default async function ManagerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("MANAGER");
  const params = await searchParams;
  const { from, to, fromValue, toValue } = dateRange(params);
  const search = singleParam(params, "q");
  const waiterId = singleParam(params, "waiterId");
  const tableId = singleParam(params, "tableId");
  const status = Object.values(OrderStatus).find((item) => item === singleParam(params, "status"));
  const paymentStatus = Object.values(PaymentStatus).find(
    (item) => item === singleParam(params, "paymentStatus"),
  );
  const minTotal = validAmountParam(singleParam(params, "minTotal"));
  const maxTotal = validAmountParam(singleParam(params, "maxTotal"));
  const [orders, users, tables] = await Promise.all([
    listOrders({
      from,
      to,
      take: 200,
      search,
      waiterId,
      tableId,
      status,
      paymentStatus,
      minTotal,
      maxTotal,
    }),
    listUsers(),
    listTables(),
  ]);
  const fields: ListFilterField[] = [
    { name: "from", label: "From", type: "date", value: fromValue },
    { name: "to", label: "To", type: "date", value: toValue },
    { name: "q", label: "Search", type: "search", value: search, placeholder: "Order, item, waiter, table" },
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
      <h1 className="font-display text-2xl text-zenith-gold">Orders</h1>
      <div className="mt-1">
        <VisibleDate />
      </div>
      <p className="mt-2 text-sm">
        <Link href="/manager/reports" className="font-semibold text-zenith-gold">
          Reports &amp; history →
        </Link>
      </p>

      <div className="mt-5">
        <ListFilterForm fields={fields} action="/manager/orders" />
      </div>
      <p className="mb-2 text-xs text-zenith-muted">{orders.length} orders shown (maximum 200).</p>
      <div className="mt-6 grid gap-3">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
            No orders match these dates and filters.
          </p>
        ) : null}
        {orders.map((order) => (
          <article key={order.id} className="min-w-0 rounded-xl border border-zenith-border bg-white p-3">
            <Link href={`/manager/orders/${order.id}`} className="block min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-zenith-gold">#{order.orderNumber}</div>
                  <div className="mt-1 text-base">
                    {order.waiter.name} · Table {order.table.name}
                  </div>
                  <div className="text-sm">{formatDateTime(order.createdAt)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <OrderBadge status={order.status} />
                  <PaymentBadge status={order.paymentStatus} />
                </div>
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
    </div>
  );
}
