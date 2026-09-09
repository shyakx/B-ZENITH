import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { SupplierActiveButton, SupplierForm } from "@/components/manager/InventoryForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listSuppliers } from "@/services/suppliers";

export default async function SuppliersPage() {
  await requireRole("MANAGER");
  const suppliers = await listSuppliers();

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Inactive suppliers cannot be used for new receipts." />
      <p className="mb-4 text-sm">
        <Link href="/manager/inventory/history" className="font-semibold text-zenith-gold">
          Purchase receipts history →
        </Link>
      </p>
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
    </div>
  );
}
