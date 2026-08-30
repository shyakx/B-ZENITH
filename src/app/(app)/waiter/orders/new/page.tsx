import { requireRole } from "@/lib/auth/current-user";
import { NewOrderScreen } from "@/components/pos/NewOrderScreen";
import { listActiveProducts, listCategories, listTables } from "@/services/products";
import { draftCartFromOrder } from "@/lib/domain/void-order";
import { getOrderById } from "@/services/orders";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ again?: string }>;
}) {
  const user = await requireRole("WAITER");
  const { again } = await searchParams;
  const [tables, products, categories] = await Promise.all([
    listTables(true),
    listActiveProducts(),
    listCategories(),
  ]);

  let initialTableId: string | undefined;
  let initialLines:
    | { product: (typeof products)[number]; quantity: number }[]
    | undefined;

  if (again) {
    const previous = await getOrderById(again);
    const draft = draftCartFromOrder(previous, user.id, products);
    initialTableId = draft.tableId;
    initialLines = draft.lines
      .map((line) => {
        const product = products.find((entry) => entry.id === line.productId);
        if (!product) return null;
        return { product, quantity: line.quantity };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);
  }

  return (
    <NewOrderScreen
      tables={tables.map((table) => ({ id: table.id, name: table.name }))}
      products={products}
      categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      initialTableId={initialTableId}
      initialLines={initialLines}
    />
  );
}
