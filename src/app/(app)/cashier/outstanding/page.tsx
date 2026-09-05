import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { requireRole } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { SettleCreditButton } from "@/components/cashier/SettleCreditButton";
import { PaymentBadge } from "@/components/ui/Badge";
import { listOutstanding } from "@/services/payments";

export default async function OutstandingPage() {
  await requireRole("CASHIER");
  const credits = await listOutstanding();

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Customer credit</h1>
      <p className="mt-1 text-zenith-muted">
        Customers who were allowed to pay later. Open unpaid and partial bills stay on Orders / Bills.
      </p>

      <div className="mt-6 space-y-3">
        {credits.length === 0 ? (
          <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
            No customer credit right now.
          </p>
        ) : null}
        {credits.map((credit) => (
          <article key={credit.id} className="rounded-2xl border border-zenith-border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display text-2xl text-zenith-gold">{credit.customerName}</div>
                {credit.customerPhone ? <div className="mt-1 text-base">{credit.customerPhone}</div> : null}
                <div className="mt-2 text-base">Order #{credit.order.orderNumber}</div>
                <div className="text-base">Table {credit.order.table.name}</div>
                <div className="text-base">Waiter {credit.order.waiter.name}</div>
                <div className="mt-3 space-y-1 text-sm">
                  <div>Order: {formatDate(credit.order.createdAt)}</div>
                  <div>Pay later recorded: {formatDate(credit.createdAt)}</div>
                </div>
                <div className="mt-2">
                  <PaymentBadge status="PAY_LATER" />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">
                  Amount owed
                </div>
                <div className="font-display text-2xl text-zenith-gold">{formatRwf(credit.amountOwed)}</div>
                <div className="mt-3 flex flex-col items-end gap-2">
                  <PrintFactureLink href={`/print/order/${credit.order.id}`} />
                  <SettleCreditButton
                    creditId={credit.id}
                    amountOwed={credit.amountOwed}
                    customerName={credit.customerName}
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
