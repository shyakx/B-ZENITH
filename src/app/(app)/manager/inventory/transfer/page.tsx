import { requireRole } from "@/lib/auth/current-user";
import { LOCATION_CODES } from "@/lib/domain/locations";
import { TransferForm } from "@/components/manager/InventoryForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listLocations, listStock, listTransfers } from "@/services/inventory";

export default async function TransferStockPage() {
  await requireRole("MANAGER");
  const [stock, locations, transfers] = await Promise.all([listStock(), listLocations(), listTransfers(20)]);
  const destinations = locations.filter((location) => location.code !== LOCATION_CODES.MAIN && location.active);

  return (
    <div>
      <PageHeader
        title="Move Stock"
        subtitle="Move from Main Stock to Bar, Kitchen, or Cafe."
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card>
          <TransferForm products={stock} destinations={destinations} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Recent moves</h2>
          <div className="space-y-2 text-sm">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="flex justify-between gap-2">
                <span>
                  {transfer.fromLocation.name} → {transfer.toLocation.name}
                  {transfer.lines[0] ? ` · ${transfer.lines[0].product.name}` : ""}
                </span>
                <span>{transfer.lines.reduce((sum, line) => sum + line.baseQuantity, 0)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
