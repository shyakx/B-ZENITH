import { MovementType } from "@prisma/client";
import { formatDateTime, formatReportRange } from "@/lib/dates";
import { formatStockQty } from "@/lib/domain/units";

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Receive",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  COUNT: "Count",
  ADJUSTMENT: "Adjust",
  WASTE: "Waste",
  SALE: "Sale",
  VOID_RESTORE: "Sale voided",
};

export type StockHistoryPrintRow = {
  id: string;
  createdAt: Date;
  productName: string;
  type: MovementType;
  locationName: string | null;
  quantity: number;
  unitCode: string | null;
  staffName: string;
  reason: string | null;
};

export function StockHistoryDocument({
  businessName,
  from,
  to,
  actionFilter,
  rows,
}: {
  businessName: string;
  from: Date;
  to: Date;
  actionFilter: string;
  rows: StockHistoryPrintRow[];
}) {
  return (
    <article className="stock-history-report">
      <header className="stock-history-report__header">
        <p className="stock-history-report__eyebrow">{businessName}</p>
        <h1>Stock History</h1>
        <p className="stock-history-report__meta">
          {formatReportRange(from, to)}
          {actionFilter !== "All actions" ? ` · ${actionFilter}` : ""}
        </p>
        <p className="stock-history-report__meta">{rows.length} stock change{rows.length === 1 ? "" : "s"}</p>
      </header>

      {rows.length === 0 ? (
        <p>No stock changes in this range.</p>
      ) : (
        <table className="stock-history-report__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Action</th>
              <th>Location</th>
              <th className="num">Qty</th>
              <th>Unit</th>
              <th>Staff</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="nowrap">{formatDateTime(row.createdAt)}</td>
                <td>{row.productName}</td>
                <td>{TYPE_LABELS[row.type] ?? row.type}</td>
                <td>{row.locationName ?? "—"}</td>
                <td className="num">
                  {row.quantity > 0 ? "+" : ""}
                  {formatStockQty(row.quantity, row.unitCode)}
                </td>
                <td>{row.unitCode ?? "—"}</td>
                <td>
                  {row.staffName}
                  {row.reason ? (
                    <>
                      <br />
                      <span className="muted">{row.reason}</span>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
