import { requireRole } from "@/lib/auth/current-user";
import { CountForm } from "@/components/manager/InventoryForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listLocations, listStock } from "@/services/inventory";

export default async function StockCountPage() {
  await requireRole("MANAGER");
  const [stock, locations] = await Promise.all([listStock(), listLocations()]);

  return (
    <div>
      <PageHeader title="Stock Count" subtitle="Count what is physically in one place, then save." />
      <div className="max-w-md">
        <Card>
          <CountForm products={stock} locations={locations.filter((location) => location.active)} />
        </Card>
      </div>
    </div>
  );
}
