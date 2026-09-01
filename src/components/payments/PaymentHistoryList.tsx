import { formatRwf } from "@/lib/domain/money";
import {
  paymentHistoryRows,
  type PaymentHistorySource,
} from "@/lib/domain/payment-history";

export function PaymentHistoryList({
  payments,
}: {
  payments: PaymentHistorySource[];
}) {
  const rows = paymentHistoryRows(payments);
  if (rows.length === 0) return null;

  return (
    <div className="text-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">
        Payment history
      </div>
      <ul className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span>
              {row.date} · {row.time} · {row.method}
            </span>
            <span className="font-semibold">{formatRwf(row.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
