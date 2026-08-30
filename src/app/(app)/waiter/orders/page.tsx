import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { Badge, PaymentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { VoidOrderButton } from "@/components/waiter/VoidOrderButton";
import { canWaiterVoidOrder } from "@/lib/domain/void-order";
import { listOrders } from "@/services/orders";

export default async function MyOrdersPage() {
  const user = await requireRole("WAITER");
  const orders = await listOrders({ waiterId: user.id, take: 80 });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-zenith-gold">My orders</h1>
          <p className="mt-1 text-zenith-muted">Only your orders. Payment is handled by the cashier.</p>
        </div>
        <Link href="/waiter/orders/new">
          <Button>+ New order</Button>
        </Link>
      </div>
      <div className="space-y-3">
        {orders.length === 0 ? <p className="text-zenith-muted">No orders yet.</p> : null}
        {orders.map((order) => (
          <article id={`order-${order.id}`} key={order.id} className="rounded-3xl border border-zenith-border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-display text-3xl text-zenith-gold">#{order.orderNumber}</div>
                <div className="mt-1 text-lg">Table {order.table.name}</div>
                <div className="text-sm text-zenith-muted">{formatDateTime(order.createdAt)}</div>
              </div>
              {order.status === "CANCELLED" ? (
                <Badge className="bg-zenith-surface text-zenith-muted border-zenith-border">VOIDED</Badge>
              ) : (
                <PaymentBadge status={order.paymentStatus} />
              )}
            </div>
            <ul className="mt-3 text-zenith-muted">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.name} × {item.quantity}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-2xl font-semibold">{formatRwf(order.total)}</div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
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
