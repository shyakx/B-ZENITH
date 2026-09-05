import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { formatRwf } from "@/lib/domain/money";
import { combinedBill } from "@/lib/domain/payments";
import { PaymentPanel } from "@/components/cashier/PaymentPanel";
import { PaymentHistoryList } from "@/components/payments/PaymentHistoryList";
import { CancelOrderButton } from "@/components/cashier/CancelOrderButton";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { PaymentBadge } from "@/components/ui/Badge";
import { getCurrentTableBill } from "@/services/orders";

export default async function TableBillPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  await requireRole("CASHIER");
  const { tableId } = await params;
  const billData = await getCurrentTableBill(tableId);
  if (!billData) notFound();

  const { table, orders } = billData;
  const bill = combinedBill(orders);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-zenith-gold">TABLE {table.name}</h1>
          <p className="mt-1 text-zenith-muted">Pay one order or the remaining table balance.</p>
        </div>
        {orders.length > 0 ? (
          <PrintFactureLink href={`/print/table/${tableId}`} label="Print table facture" />
        ) : null}
      </div>

      {orders.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-zenith-border bg-white px-4 py-8 text-center font-semibold">
          No open bill for this table.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-4">
            {orders.map((order) => {
              const due = Math.max(0, order.total - order.paidAmount);
              return (
                <article
                  key={order.id}
                  id={`order-${order.id}`}
                  className="rounded-2xl border border-zenith-border bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-2xl text-zenith-gold">ORDER #{order.orderNumber}</div>
                      <div className="mt-1 text-base">Table {order.table.name}</div>
                      <div className="text-base">Waiter: {order.waiter.name}</div>
                    </div>
                    <PaymentBadge status={order.paymentStatus} />
                  </div>

                  <ul className="mt-4 space-y-2">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex flex-wrap justify-between gap-2 text-base">
                        <span>
                          {item.quantity} × {item.name}
                        </span>
                        <span className="font-semibold">
                          {formatRwf(item.unitPrice)} · {formatRwf(item.lineTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zenith-border pt-4 text-sm">
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

                  {order.payments.length > 0 ? (
                    <div className="mt-3 border-t border-zenith-border pt-3">
                      <PaymentHistoryList payments={order.payments} />
                    </div>
                  ) : null}

                  <div className="mt-4 border-t border-zenith-border pt-4">
                    <PaymentPanel
                      mode="order"
                      targetId={order.id}
                      remaining={due}
                      tableName={table.name}
                      total={order.total}
                      paid={order.paidAmount}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <PrintFactureLink href={`/print/order/${order.id}`} />
                    {order.paymentStatus === "UNPAID" && order.status !== "CANCELLED" ? (
                      <CancelOrderButton orderId={order.id} />
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <div className="rounded-2xl border-2 border-zenith-gold bg-white p-5">
              <h2 className="font-display text-2xl text-zenith-gold">Pay table</h2>
              <div className="mt-3 space-y-2 text-base">
                <div className="flex justify-between">
                  <span>Table total</span>
                  <span className="font-semibold">{formatRwf(bill.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span className="font-semibold">{formatRwf(bill.paid)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span>Remaining</span>
                  <span className="font-semibold text-zenith-gold">{formatRwf(bill.remaining)}</span>
                </div>
              </div>
              <div className="mt-4">
                <PaymentPanel
                  mode="table"
                  targetId={tableId}
                  remaining={bill.remaining}
                  tableName={table.name}
                />
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
