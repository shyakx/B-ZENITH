import { requireRole } from "@/lib/auth/current-user";
import { endOfDay, formatDateTime, startOfDay } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { listPayments } from "@/services/payments";

export default async function PaymentsPage() {
  await requireRole("CASHIER");
  const from = startOfDay();
  const to = endOfDay();
  const payments = await listPayments(from, to);
  const cashToday = payments
    .filter((payment) => payment.method === "CASH")
    .reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Payments</h1>
      <div className="mt-2">
        <VisibleDate />
      </div>
      <p className="mt-2 text-zenith-muted">Cash recorded on this Rwanda calendar date.</p>
      <p className="mt-4 font-display text-2xl text-zenith-gold">{formatRwf(cashToday)}</p>

      <div className="mt-6 space-y-3">
        {payments.length === 0 ? (
          <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
            No payments on this date.
          </p>
        ) : null}
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zenith-border bg-white p-4"
          >
            <div className="min-w-0">
              <div className="font-semibold">
                Table {payment.order.table.name} · Order #{payment.order.orderNumber}
              </div>
              <div className="text-sm">
                {payment.order.waiter.name} · {payment.cashier.name}
              </div>
              <div className="text-sm font-semibold">{formatDateTime(payment.createdAt)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-display text-xl text-zenith-gold">{formatRwf(payment.amount)}</div>
              <PrintFactureLink href={`/print/order/${payment.order.id}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
