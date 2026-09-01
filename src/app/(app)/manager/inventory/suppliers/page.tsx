import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { SupplierActiveButton, SupplierForm } from "@/components/manager/InventoryForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listSupplierHistory, listSuppliers } from "@/services/suppliers";

export default async function SuppliersPage() {
  await requireRole("MANAGER");
  const suppliers = await listSuppliers();
  const history = suppliers[0] ? await listSupplierHistory(suppliers[0].id, 8) : [];

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Inactive suppliers cannot be used for new receipts." />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Add supplier</h2>
          <SupplierForm />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Directory</h2>
          <div className="space-y-3">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{supplier.name}</div>
                  <div className="text-sm text-zenith-muted">
                    {supplier.active ? "Active" : "Inactive"}
                    {supplier.phone ? ` · ${supplier.phone}` : ""}
                  </div>
                </div>
                <SupplierActiveButton id={supplier.id} active={supplier.active} />
              </div>
            ))}
          </div>
        </Card>
      </div>
      {history.length > 0 ? (
        <Card className="mt-4">
          <h2 className="mb-3 font-semibold">Latest receipts</h2>
          <div className="space-y-2 text-sm">
            {history.map((receipt) => (
              <div key={receipt.id} className="flex justify-between gap-2">
                <span>
                  {receipt.lines.map((line) => line.product.name).join(", ")} · {receipt.receivedBy.name}
                </span>
                <span>{formatDateTime(receipt.receivedAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
