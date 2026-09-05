import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatRwf } from "@/lib/domain/money";
import { combinedBill } from "@/lib/domain/payments";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { PaymentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listOpenOrdersByTable } from "@/services/orders";

export default async function BillsPage() {
  await requireRole("CASHIER");
  const groups = await listOpenOrdersByTable();

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Orders / Bills</h1>
      <p className="mt-1 text-zenith-muted">
        Unpaid and partial bills by table. Customer credit (pay later) is under Customer credit.
      </p>

      <div className="mt-6 space-y-4">
        {groups.length === 0 ? (
          <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
            No open bills.
          </p>
        ) : null}
        {groups.map((group) => {
          const bill = combinedBill(group.orders);
          return (
            <article key={group.tableId} className="min-w-0 rounded-xl border border-zenith-border bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl text-zenith-gold">TABLE {group.tableName}</h2>
                <PaymentBadge status={bill.status} />
              </div>
              <div className="space-y-2">
                {group.orders.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <span>
                      Order #{order.orderNumber} — {order.waiter.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{formatRwf(order.total)}</span>
                      <PrintFactureLink href={`/print/order/${order.id}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zenith-border pt-4 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">
                    Table total
                  </div>
                  <div className="text-lg font-semibold">{formatRwf(bill.total)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Paid</div>
                  <div className="text-lg font-semibold">{formatRwf(bill.paid)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">
                    Balance
                  </div>
                  <div className="text-lg font-semibold text-zenith-gold">{formatRwf(bill.remaining)}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/cashier/bills/${group.tableId}`}>
                  <Button>Open bill</Button>
                </Link>
                <PrintFactureLink href={`/print/table/${group.tableId}`} label="Print table facture" />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
