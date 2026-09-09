import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { PackagingSetupEditor } from "@/components/manager/PackagingSetupEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { listUnits } from "@/services/inventory";
import { listTrackedProductPackaging } from "@/services/products";

export default async function PackagingSetupPage() {
  await requireRole("MANAGER");
  const [products, units] = await Promise.all([listTrackedProductPackaging(), listUnits()]);

  const rows = products.map((product) => {
    const pack = product.packs[0];
    return {
      id: product.id,
      name: product.name,
      categoryName: product.category.name,
      stockUnitId: product.baseUnit?.id ?? null,
      stockUnitCode: product.baseUnit?.code ?? null,
      stockUnitName: product.baseUnit?.name ?? null,
      packageUnitId: pack?.unitId ?? null,
      packageUnitCode: pack?.unit.code ?? null,
      unitsPerPackage: pack?.baseQuantity ?? null,
      wholePackageTransfer: product.wholePackageTransfer,
    };
  });

  return (
    <div>
      <PageHeader title="Packaging" subtitle="Set how many stock units are in one package." />
      <p className="mb-4 text-sm">
        <Link href="/manager/products" className="font-semibold text-zenith-gold">
          Products →
        </Link>
      </p>
      <PackagingSetupEditor products={rows} units={units} />
    </div>
  );
}
