import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { LOCATION_CODES } from "@/lib/domain/locations";
import { formatRwf } from "@/lib/domain/money";
import { CategoryForm, CategoryRow, ProductEditor, ProductForm } from "@/components/manager/ProductForm";
import { ProductCatalog } from "@/components/manager/ProductCatalog";
import { Card } from "@/components/ui/Card";
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
      sellingPrice: formatRwf(product.sellingPrice),
      productType: product.productType,
      sellOnPos: product.sellOnPos,
      active: product.active,
      trackInventory: product.trackInventory,
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
      },
    };
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Products</h1>
      <p className="mt-1 text-sm text-zenith-muted">
        Menu products appear on POS. Inventory materials are received and used in the kitchen or cafe.
      </p>

      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Add product</h2>
          <ProductForm categories={categories} locations={locations} units={units} />
        </Card>
        <div className="min-w-0 space-y-4">
          <Card>
            <h2 className="mb-3 font-semibold">Categories</h2>
            <p className="mb-3 text-sm">
              Bar, Cafe and Kitchen here are menu groups, not stock rooms.
            </p>
            <CategoryForm />
            <ul className="mt-3 min-w-0 space-y-3">
              {categories.map((category) => (
                <li key={category.id} className="min-w-0">
                  <div className="text-sm">
                    {category.name} · {category.area} · {category._count.products} products
                  </div>
                  <CategoryRow category={category} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold">Tables</h2>
            <Link href="/manager/tables" className="text-sm font-semibold text-zenith-gold">
              Open table management →
            </Link>
          </Card>
        </div>
      </div>

      <ProductCatalog
        items={items}
        categories={categories}
        locations={locations}
        units={units}
      />
    </div>
  );
}
