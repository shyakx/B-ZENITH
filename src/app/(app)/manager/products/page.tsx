import { requireRole } from "@/lib/auth/current-user";
import { formatRwf } from "@/lib/domain/money";
import { CategoryForm, CategoryRow, ProductEditor, ProductForm, TableForm, TableRow } from "@/components/manager/ProductForm";
import { Card } from "@/components/ui/Card";
import { listAllProducts, listCategories, listTables } from "@/services/products";

export default async function ProductsPage() {
  await requireRole("MANAGER");
  const [products, categories, tables] = await Promise.all([
    listAllProducts(),
    listCategories(),
    listTables(),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-3xl text-zenith-gold">Products</h1>
      <p className="mt-1 text-zenith-muted">Menu, categories and tables. Price changes do not rewrite old orders.</p>

      <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Add product</h2>
          <ProductForm categories={categories} />
        </Card>
        <div className="min-w-0 space-y-4">
          <Card>
            <h2 className="mb-3 font-semibold">Categories</h2>
            <p className="mb-3 text-sm">Bar, Cafe and Kitchen are menu areas, not staff roles.</p>
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
            <h2 className="mb-3 font-semibold">Tables</h2>
            <p className="mb-3 text-sm">Any waiter can serve any active table.</p>
            <TableForm />
            <div className="mt-3 min-w-0">
              {tables.map((table) => (
                <TableRow key={table.id} table={table} />
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid min-w-0 gap-3">
        {products.map((product) => (
          <article key={product.id} className="min-w-0 rounded-2xl border border-zenith-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{product.name}</div>
                <div className="text-sm">
                  {product.category.name} · {formatRwf(product.sellingPrice)} ·{" "}
                  {product.trackInventory ? `Stock ${product.stockQuantity}` : "No stock tracking"} ·{" "}
                  {product.active ? "Active" : "Inactive"}
                </div>
              </div>
              <ProductEditor
                categories={categories}
                product={{
                  id: product.id,
                  name: product.name,
                  categoryId: product.categoryId,
                  sellingPrice: product.sellingPrice,
                  costPrice: product.costPrice,
                  trackInventory: product.trackInventory,
                  active: product.active,
                }}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
