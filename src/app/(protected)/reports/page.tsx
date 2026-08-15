import type { ReactNode } from "react";
import { requireUser } from "@/lib/authorization";
import { formatMoney, kigaliRange, paymentLabel } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-white">
      <h2 className="border-b p-4 text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function empty(text: string) {
  return <p className="p-8 text-center text-stone-500">{text}</p>;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireUser(["OWNER", "ADMIN"]);
  const filters = await searchParams;
  const { fromDay, toDay, start, end } = kigaliRange(filters.from, filters.to);
  const saleWhere = { status: { not: "VOIDED" as const }, createdAt: { gte: start, lt: end } };

  const [sales, payments, productRows, expenses, movements, trackedProducts, settings] = await Promise.all([
    prisma.sale.findMany({ where: saleWhere, select: { createdAt: true, total: true } }),
    prisma.sale.groupBy({ by: ["paymentMethod"], where: saleWhere, _sum: { total: true }, _count: true }),
    prisma.saleItem.findMany({
      where: { sale: saleWhere },
      select: {
        productName: true,
        quantity: true,
        lineSubtotal: true,
        product: { select: { category: { select: { name: true } } } },
      },
    }),
    prisma.expense.groupBy({ by: ["category"], where: { incurredAt: { gte: start, lt: end } }, _sum: { amount: true }, _count: true }),
    prisma.inventoryMovement.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { product: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { trackInventory: true, active: true },
      orderBy: { name: "asc" },
      select: { name: true, stockQuantity: true, reorderLevel: true, costPrice: true },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);

  const currency = settings?.currency ?? "RWF";
  const daily = new Map<string, { count: number; total: number }>();
  for (const sale of sales) {
    const day = sale.createdAt.toLocaleDateString("en-CA", { timeZone: "Africa/Kigali" });
    const current = daily.get(day) ?? { count: 0, total: 0 };
    daily.set(day, { count: current.count + 1, total: current.total + sale.total.toNumber() });
  }

  const products = new Map<string, { quantity: number; revenue: number }>();
  const categories = new Map<string, { quantity: number; revenue: number }>();
  for (const row of productRows) {
    const product = products.get(row.productName) ?? { quantity: 0, revenue: 0 };
    product.quantity += row.quantity;
    product.revenue += row.lineSubtotal.toNumber();
    products.set(row.productName, product);
    const categoryName = row.product.category.name;
    const category = categories.get(categoryName) ?? { quantity: 0, revenue: 0 };
    category.quantity += row.quantity;
    category.revenue += row.lineSubtotal.toNumber();
    categories.set(categoryName, category);
  }

  const productList = [...products.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 50);
  const categoryList = [...categories.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const lowStock = trackedProducts.filter((product) => product.stockQuantity <= product.reorderLevel);
  const valuation = trackedProducts.reduce((sum, product) => sum + product.stockQuantity * product.costPrice.toNumber(), 0);
  const revenue = sales.reduce((sum, sale) => sum + sale.total.toNumber(), 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Performance</p>
        <h1 className="text-3xl font-black">Reports</h1>
        <p className="mt-1 text-sm text-stone-500">All totals use Africa/Kigali dates and live PostgreSQL data.</p>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 print:hidden">
        <label className="text-sm font-bold">From<input name="from" type="date" defaultValue={fromDay} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-bold">To<input name="to" type="date" defaultValue={toDay} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" /></label>
        <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Apply</button>
      </form>
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Revenue</p><p className="mt-1 text-2xl font-black">{formatMoney(revenue, currency)}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Transactions</p><p className="mt-1 text-2xl font-black">{sales.length}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Tracked stock value</p><p className="mt-1 text-2xl font-black">{formatMoney(valuation, currency)}</p></article>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Daily sales">
          <div className="divide-y">
            {[...daily.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, value]) => (
              <div key={day} className="flex justify-between p-4">
                <span>{day}<small className="ml-2 text-stone-500">{value.count} sales</small></span>
                <b>{formatMoney(value.total, currency)}</b>
              </div>
            ))}
            {daily.size === 0 && empty("No sales in this period.")}
          </div>
        </Section>
        <Section title="Payment report">
          <div className="divide-y">
            {payments.map((row) => (
              <div key={row.paymentMethod} className="flex justify-between p-4">
                <span>{paymentLabel(row.paymentMethod)} <small className="text-stone-500">({row._count})</small></span>
                <b>{formatMoney(row._sum.total?.toNumber() ?? 0, currency)}</b>
              </div>
            ))}
            {payments.length === 0 && empty("No payments in this period.")}
          </div>
        </Section>
        <Section title="Product performance">
          <div className="max-h-[500px] divide-y overflow-y-auto">
            {productList.map(([name, value]) => (
              <div key={name} className="flex justify-between p-4">
                <span>{name}<small className="ml-2 text-stone-500">× {value.quantity}</small></span>
                <b>{formatMoney(value.revenue, currency)}</b>
              </div>
            ))}
            {productList.length === 0 && empty("No product sales in this period.")}
          </div>
        </Section>
        <Section title="Category performance">
          <div className="divide-y">
            {categoryList.map(([name, value]) => (
              <div key={name} className="flex justify-between p-4">
                <span>{name}<small className="ml-2 text-stone-500">× {value.quantity}</small></span>
                <b>{formatMoney(value.revenue, currency)}</b>
              </div>
            ))}
            {categoryList.length === 0 && empty("No category sales in this period.")}
          </div>
        </Section>
        <Section title="Inventory — current stock">
          <div className="max-h-[500px] divide-y overflow-y-auto">
            {trackedProducts.map((product) => (
              <div key={product.name} className="flex justify-between p-4">
                <span>{product.name}</span>
                <b className={product.stockQuantity <= product.reorderLevel ? "text-amber-700" : ""}>{product.stockQuantity}</b>
              </div>
            ))}
            {trackedProducts.length === 0 && empty("No products are currently tracking stock.")}
          </div>
        </Section>
        <Section title="Low stock">
          <div className="divide-y">
            {lowStock.map((product) => (
              <div key={product.name} className="flex justify-between p-4">
                <span>{product.name}</span>
                <b className="text-amber-700">{product.stockQuantity}</b>
              </div>
            ))}
            {lowStock.length === 0 && empty("No low-stock products.")}
          </div>
        </Section>
        <Section title="Stock movements">
          <div className="max-h-[500px] divide-y overflow-y-auto">
            {movements.map((movement) => (
              <div key={movement.id} className="flex justify-between p-4">
                <span>{movement.product.name}<small className="ml-2 text-stone-500">{movement.type}</small></span>
                <b className={movement.quantity < 0 ? "text-red-700" : "text-green-700"}>
                  {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                </b>
              </div>
            ))}
            {movements.length === 0 && empty("No stock movements in this period.")}
          </div>
        </Section>
        <Section title="Expenses">
          <div className="divide-y">
            {expenses.map((row) => (
              <div key={row.category} className="flex justify-between p-4">
                <span>{row.category}<small className="ml-2 text-stone-500">({row._count})</small></span>
                <b>{formatMoney(row._sum.amount?.toNumber() ?? 0, currency)}</b>
              </div>
            ))}
            {expenses.length === 0 && empty("No expenses in this period.")}
          </div>
        </Section>
      </div>
    </div>
  );
}
