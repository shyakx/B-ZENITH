import { requireRole } from "@/lib/auth/current-user";
import { InventoryMovementsTable } from "@/components/manager/InventoryMovementsTable";
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
      <InventoryMovementsTable rows={rows} />
    </div>
  );
}
