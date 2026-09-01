import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { OrderBadge, PaymentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getOrderById } from "@/services/orders";

export default async function ManagerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireRole("MANAGER");
  const { orderId } = await params;
  const order = await getOrderById(orderId);
  if (!order) notFound();

  const due = Math.max(0, order.total - order.paidAmount);

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link href="/manager/orders" className="text-sm font-semibold text-zenith-gold">
        ← All orders
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
      <h1 className="font-display text-2xl text-zenith-gold">ORDER #{order.orderNumber}</h1>
          <p className="mt-1">{formatDateTime(order.createdAt)}</p>
          <p className="mt-1 text-base">Table {order.table.name}</p>
          <p className="text-base">Waiter: {order.waiter.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      </div>

      <ul className="mt-6 space-y-2 rounded-2xl border border-zenith-border bg-white p-4">
        {order.items.map((item) => (
          <li key={item.id} className="flex flex-wrap justify-between gap-2">
            <span>
              {item.quantity} × {item.name}
            </span>
            <span className="font-semibold">
              {formatRwf(item.unitPrice)} · {formatRwf(item.lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-zenith-border bg-white p-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Total</div>
          <div className="text-lg font-semibold">{formatRwf(order.total)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Paid</div>
          <div className="text-lg font-semibold">{formatRwf(order.paidAmount)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Balance</div>
          <div className="text-lg font-semibold text-zenith-gold">{formatRwf(due)}</div>
        </div>
      </div>

      <p className="mt-4 text-sm">Payment is recorded by the cashier. This screen is view only.</p>

      <div className="mt-4">
        <Link href={`/print/order/${order.id}`} target="_blank">
          <Button variant="secondary">Print facture</Button>
        </Link>
      </div>
    </div>
  );
}
