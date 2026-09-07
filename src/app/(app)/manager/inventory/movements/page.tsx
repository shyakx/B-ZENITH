import { requireRole } from "@/lib/auth/current-user";
import { formatStockQty } from "@/lib/domain/units";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listInventoryMovementReport } from "@/services/inventory";

export default async function InventoryMovementsReportPage() {
  await requireRole("MANAGER");
  const rows = await listInventoryMovementReport();

  return (
    <div>
      <PageHeader
        title="Stock Movements"
        subtitle="See current stock beside recorded movement history. These columns are not a balancing equation."
      />
      <Card className="mb-4">
        <p className="text-sm text-zenith-muted">
          <strong className="text-zenith-ink">Current on-hand stock</strong> is what is in the store now.
          <strong className="text-zenith-ink"> Recorded movements</strong> (received, sold, returned, wasted,
          adjusted, transfers) are totals from history after the system started logging each change. Current stock
          includes opening stock entered before movement history began, so the movement columns will not always add up
          to the current stock.
        </p>
      </Card>
      <Card>
        <div className="overflow-x-auto text-sm">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-zenith-border text-xs uppercase tracking-wider text-zenith-muted">
                <th className="py-2 pr-2" rowSpan={2}>
                  Product
                </th>
                <th className="py-2 pr-2" rowSpan={2}>
                  Unit
                </th>
                <th className="py-2 pr-2 text-right" rowSpan={2}>
                  Current on-hand stock
                </th>
                <th className="py-2 text-center" colSpan={7}>
                  Recorded movements
                </th>
              </tr>
              <tr className="border-b border-zenith-border text-xs uppercase tracking-wider text-zenith-muted">
                <th className="py-2 pr-2 text-right">Received</th>
                <th className="py-2 pr-2 text-right">Sold</th>
                <th className="py-2 pr-2 text-right">Returned</th>
                <th className="py-2 pr-2 text-right">Wasted</th>
                <th className="py-2 pr-2 text-right">Adjusted</th>
                <th className="py-2 pr-2 text-right">Transfer in</th>
                <th className="py-2 text-right">Transfer out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const unit = row.unitCode;
                return (
                  <tr key={row.id} className="border-b border-zenith-border/70 align-top">
                    <td className="py-2 pr-2">
                      <div className="font-semibold">{row.name}</div>
                      {row.managerReferenceName ? (
                        <div className="text-xs text-zenith-muted">{row.managerReferenceName}</div>
                      ) : null}
                      <div className="text-xs text-zenith-muted">{row.category}</div>
                    </td>
                    <td className="py-2 pr-2 font-semibold">{unit ?? "—"}</td>
                    <td className="py-2 pr-2 text-right font-semibold">{formatStockQty(row.onHand, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.received, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.sold, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.returned, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.wasted, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.adjusted, unit)}</td>
                    <td className="py-2 pr-2 text-right">{formatStockQty(row.transferIn, unit)}</td>
                    <td className="py-2 text-right">{formatStockQty(row.transferOut, unit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
