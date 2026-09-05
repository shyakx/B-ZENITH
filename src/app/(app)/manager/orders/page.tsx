import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { OrderBadge, PaymentBadge } from "@/components/ui/Badge";
import { listOrders } from "@/services/orders";

export default async function ManagerOrdersPage() {
  await requireRole("MANAGER");
  const orders = await listOrders({ take: 120 });

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Orders</h1>
      <p className="mt-1 text-zenith-muted">All waiters. Each order stays separate.</p>

      <div className="mt-6 grid gap-3">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
            No orders yet.
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
