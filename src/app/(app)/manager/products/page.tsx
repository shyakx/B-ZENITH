import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { LOCATION_CODES } from "@/lib/domain/locations";
import { formatRwf } from "@/lib/domain/money";
import { CategoryCatalog } from "@/components/manager/CategoryCatalog";
import { ProductCatalog } from "@/components/manager/ProductCatalog";
import { ProductForm } from "@/components/manager/ProductForm";
import { listLocations, listUnits } from "@/services/inventory";
import { listAllProducts, listCategories } from "@/services/products";

export default async function ProductsPage() {
  await requireRole("MANAGER");
  const [products, categories, locations, units] = await Promise.all([
    listAllProducts(),
    listCategories(),
    listLocations(),
    listUnits(),
  ]);

  const items = products.map((product) => {
    const byCode = Object.fromEntries(product.stocks.map((row) => [row.location.code, row.quantity]));
    const purchase = product.packs[0];
    return {
      id: product.id,
      name: product.name,
      categoryName: product.category.name,
      categoryArea: product.category.area,
      sellingPrice: formatRwf(product.sellingPrice),
      productType: product.productType,
      sellOnPos: product.sellOnPos,
      active: product.active,
      trackInventory: product.trackInventory,
      stockUnit: product.baseUnit?.name ?? product.baseUnit?.code ?? "",
      stockLine: product.trackInventory
        ? `Main: ${byCode[LOCATION_CODES.MAIN] ?? 0} · Bar: ${byCode[LOCATION_CODES.BAR] ?? 0} · Kitchen: ${byCode[LOCATION_CODES.KITCHEN] ?? 0} · Cafe: ${byCode[LOCATION_CODES.CAFE] ?? 0}`
        : "Not tracked",
      editor: {
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice == null ? null : Number(product.costPrice.toString()),
        trackInventory: product.trackInventory,
        active: product.active,
        productType: product.productType,
        sellOnPos: product.sellOnPos,
        baseUnitId: product.baseUnitId,
        defaultStockLocationId: product.defaultStockLocationId,
        purchaseUnitId: purchase?.unitId ?? product.baseUnitId,
        purchaseContains: purchase?.baseQuantity ?? 1,
        wholePackageTransfer: product.wholePackageTransfer,
      },
    };
  });

  const categoryRows = categories.map((category) => ({
    id: category.id,
    name: category.name,
    area: category.area,
    productCount: category._count.products,
  }));

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <h1 className="font-display text-2xl text-zenith-gold">Products</h1>
      <p className="mt-2 text-sm">
        <Link href="/manager/tables" className="font-semibold text-zenith-gold">
          Manage tables →
        </Link>
      </p>

      <section className="mt-6 min-w-0 rounded-xl border border-zenith-border bg-white p-4">
        <h2 className="font-semibold text-zenith-ink">Add Product</h2>
        <div className="mt-3">
          <ProductForm categories={categories} locations={locations} units={units} />
        </div>
      </section>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
        <CategoryCatalog categories={categoryRows} />
        <ProductCatalog items={items} categories={categories} locations={locations} units={units} />
      </div>
    </div>
  );
}
