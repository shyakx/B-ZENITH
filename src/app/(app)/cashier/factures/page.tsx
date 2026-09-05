import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { PaymentBadge } from "@/components/ui/Badge";
import { listOrders } from "@/services/orders";

export default async function FacturesPage() {
  await requireRole("CASHIER");
  const orders = await listOrders({ take: 120 });

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Factures</h1>
      <p className="mt-1 text-zenith-muted">
        Print any unpaid, partial, pay-later, or paid bill. Printing does not record a payment.
      </p>

      <div className="mt-6 space-y-3">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
            No orders to print yet.
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
