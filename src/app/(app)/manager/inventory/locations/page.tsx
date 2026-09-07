import { requireRole } from "@/lib/auth/current-user";
import { InventoryLocationsTable } from "@/components/manager/InventoryLocationsTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { listStock } from "@/services/inventory";

export default async function StockByLocationPage() {
  await requireRole("MANAGER");
  const stock = await listStock();

  return (
    <div>
      <PageHeader
        title="Stock by Location"
        subtitle="See how much is in Main Stock, Bar, Kitchen, and Cafe — always with the official stock unit."
      />
      <InventoryLocationsTable stock={stock} />
    </div>
  );
}
