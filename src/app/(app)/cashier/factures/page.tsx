import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { PaymentBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { listOrders } from "@/services/orders";

export default async function FacturesPage() {
  await requireRole("CASHIER");
  const orders = await listOrders({ take: 60 });

  return (
    <div>
      <PageHeader title="Factures" subtitle="Printing a facture does not record a payment." />
      <div className="space-y-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zenith-border bg-zenith-card p-4"
          >
            <div>
              <div className="font-semibold">Order #{order.orderNumber}</div>
              <div className="text-sm text-zenith-muted">
                Table {order.table.name} · {order.waiter.name} · {formatDateTime(order.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <PaymentBadge status={order.paymentStatus} />
              <span>{formatRwf(order.total)}</span>
              <Link className="text-zenith-gold" href={`/print/order/${order.id}`}>
                Print
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
