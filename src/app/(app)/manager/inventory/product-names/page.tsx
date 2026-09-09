import { requireRole } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductNamesUnitsEditor } from "@/components/manager/ProductNamesUnitsEditor";
import { listProductNameReferences } from "@/services/products";

export default async function ProductNamesUnitsPage() {
  await requireRole("MANAGER");
  const products = await listProductNameReferences();

  return (
    <div>
      <PageHeader title="Product Names & Units" subtitle="Optional nicknames for products you manage." />
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
