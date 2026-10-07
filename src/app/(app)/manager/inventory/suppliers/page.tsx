import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { SupplierForm } from "@/components/manager/InventoryForms";
import { SupplierDirectory } from "@/components/manager/FilterableDirectories";
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
          <SupplierDirectory suppliers={suppliers} />
        </Card>
      </div>
    </div>
  );
}
