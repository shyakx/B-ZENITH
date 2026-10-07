import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { Badge, PaymentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PrintSlipLink } from "@/components/print/PrintFactureLink";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { VoidOrderButton } from "@/components/waiter/VoidOrderButton";
import { canWaiterVoidOrder } from "@/lib/domain/void-order";
import { listOrders } from "@/services/orders";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, validAmountParam, type SearchParams } from "@/lib/list-filters";
import { listTables } from "@/services/products";

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole("WAITER");
  const params = await searchParams;
  const { from, to, fromValue, toValue } = dateRange(params);
  const status = Object.values(OrderStatus).find((item) => item === singleParam(params, "status"));
  const paymentStatus = Object.values(PaymentStatus).find(
    (item) => item === singleParam(params, "paymentStatus"),
  );
  const search = singleParam(params, "q");
  const tableId = singleParam(params, "tableId");
  const minTotal = validAmountParam(singleParam(params, "minTotal"));
  const maxTotal = validAmountParam(singleParam(params, "maxTotal"));
  const orders = await listOrders({
    waiterId: user.id,
    from,
    to,
    take: 200,
    withItems: true,
    status,
    paymentStatus,
    search,
    tableId,
    minTotal,
    maxTotal,
  });
  const tables = await listTables();
  const fields: ListFilterField[] = [
    { name: "from", label: "From", type: "date", value: fromValue },
    { name: "to", label: "To", type: "date", value: toValue },
    { name: "q", label: "Search", type: "search", value: search, placeholder: "Order, item, or table" },
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
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-zenith-gold">My orders</h1>
          <div className="mt-1">
            <VisibleDate />
          </div>
        </div>
        <Link href="/waiter/orders/new">
          <Button>+ New order</Button>
        </Link>
      </div>
      <ListFilterForm fields={fields} action="/waiter/orders" />
      <p className="mb-2 text-xs text-zenith-muted">{orders.length} orders shown.</p>
      <div className="space-y-3">
        {orders.length === 0 ? <p className="text-zenith-muted">No orders match these filters.</p> : null}
        {orders.map((order) => (
          <article id={`order-${order.id}`} key={order.id} className="rounded-xl border border-zenith-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-zenith-gold">#{order.orderNumber}</div>
                <div className="mt-1 text-lg">Table {order.table.name}</div>
                <div className="text-sm text-zenith-muted">{formatDateTime(order.createdAt)}</div>
              </div>
              {order.status === "CANCELLED" ? (
                <Badge className="bg-zenith-surface text-zenith-muted border-zenith-border">VOIDED</Badge>
              ) : (
                <PaymentBadge status={order.paymentStatus} />
              )}
            </div>
            <details className="mt-3 text-sm text-zenith-muted">
              <summary className="cursor-pointer font-semibold">
                Items ({order.items.reduce((count, item) => count + item.quantity, 0)})
              </summary>
              <ul className="mt-2">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.name} × {item.quantity}
                  </li>
                ))}
              </ul>
            </details>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xl font-semibold">{formatRwf(order.total)}</div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <PrintSlipLink href={`/print/slip/order/${order.id}`} />
                <Link href={`/waiter/orders/new?again=${order.id}`}>
                  <Button variant="secondary">Order again</Button>
                </Link>
                {canWaiterVoidOrder(order, user.id) ? (
                  <VoidOrderButton
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    tableName={order.table.name}
                  />
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
