import { requireRole } from "@/lib/auth/current-user";
import { AdjustForm, WasteForm } from "@/components/manager/InventoryForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listLocations, listStock } from "@/services/inventory";

export default async function WasteAdjustPage() {
  await requireRole("MANAGER");
  const [stock, locations] = await Promise.all([listStock(), listLocations()]);
  const active = locations.filter((location) => location.active);

  return (
    <div>
      <PageHeader title="Waste / Adjustment" subtitle="Record waste or correct stock. Stock cannot go below zero." />
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Record Waste</h2>
          <WasteForm products={stock} locations={active} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Adjust Stock</h2>
          <AdjustForm products={stock} locations={active} />
        </Card>
      </div>
    </div>
  );
}
