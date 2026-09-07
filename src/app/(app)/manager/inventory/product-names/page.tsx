import { requireRole } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductNamesUnitsEditor } from "@/components/manager/ProductNamesUnitsEditor";
import { listProductNameReferences } from "@/services/products";

export default async function ProductNamesUnitsPage() {
  await requireRole("MANAGER");
  const products = await listProductNameReferences();

  return (
    <div>
      <PageHeader
        title="Product Names & Units"
        subtitle="Official stock units stay fixed for calculations. Add easy names you use to remember products."
      />
      <Card className="mb-4">
        <p className="text-sm text-zenith-muted">
          This is a reference room only. Changing a manager name or note never changes stock quantities, prices, or
          the official measurable unit.
        </p>
      </Card>
      <ProductNamesUnitsEditor
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category.name,
          unitCode: product.baseUnit?.code ?? null,
          trackInventory: product.trackInventory,
          managerReferenceName: product.managerReferenceName,
          managerReferenceNote: product.managerReferenceNote,
        }))}
      />
    </div>
  );
}
