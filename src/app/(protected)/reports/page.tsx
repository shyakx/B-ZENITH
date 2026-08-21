import type { ReactNode } from "react";
import { StockTakeHistoryTable } from "@/components/stock-take-history";
import { requireUser } from "@/lib/authorization";
import { formatMoney, kigaliRange, paymentLabel } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { summarizeSales, type ReportSale } from "@/lib/reporting";
import { STOCK_TAKE_ACTION } from "@/lib/stock-take";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-x-auto rounded-lg border bg-white">
      <h2 className="border-b p-4 text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function empty(text: string) {
  return <p className="p-8 text-center text-stone-500">{text}</p>;
}

function toReportSales(
  sales: Array<{
    createdAt: Date;
    paymentMethod: string;
    subtotal: { toNumber(): number };
    tax: { toNumber(): number };
    discount: { toNumber(): number };
    total: { toNumber(): number };
    items: Array<{
      productName: string;
      quantity: number;
      returnedQuantity: number;
      lineSubtotal: { toNumber(): number };
      product: { category: { name: string } };
    }>;
  }>,
): ReportSale[] {
  return sales.map((sale) => ({
    createdAt: sale.createdAt,
    paymentMethod: sale.paymentMethod,
    subtotal: sale.subtotal.toNumber(),
    tax: sale.tax.toNumber(),
    discount: sale.discount.toNumber(),
    total: sale.total.toNumber(),
    items: sale.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      returnedQuantity: item.returnedQuantity,
      lineSubtotal: item.lineSubtotal.toNumber(),
      categoryName: item.product.category.name,
    })),
  }));
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

  const [sales, expenses, movements, trackedProducts, stockTakes, settings] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere,
      select: {
        createdAt: true,
        paymentMethod: true,
        subtotal: true,
        tax: true,
        discount: true,
        total: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            returnedQuantity: true,
            lineSubtotal: true,
            product: { select: { category: { select: { name: true } } } },
          },
        },
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
    prisma.auditLog.findMany({
      where: { action: STOCK_TAKE_ACTION, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true } } },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);

  const currency = settings?.currency ?? "RWF";
  const summary = summarizeSales(toReportSales(sales));
  const productList = [...summary.products.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 50);
  const categoryList = [...summary.categories.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const paymentList = [...summary.payments.entries()];
  const lowStock = trackedProducts.filter((product) => product.stockQuantity <= product.reorderLevel);
  const valuation = trackedProducts.reduce((sum, product) => sum + product.stockQuantity * product.costPrice.toNumber(), 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Performance</p>
        <h1 className="text-3xl font-black">Reports</h1>
        <p className="mt-1 text-sm text-stone-500">
          Net sales subtract returned quantities at the original line prices, including proportional tax. Historical receipts are not changed.
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 print:hidden">
        <label className="text-sm font-bold">From<input name="from" type="date" defaultValue={fromDay} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-bold">To<input name="to" type="date" defaultValue={toDay} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" /></label>
        <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Apply</button>
      </form>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Gross sales</p><p className="mt-1 text-2xl font-black">{formatMoney(summary.grossTotal, currency)}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Returns</p><p className="mt-1 text-2xl font-black">{formatMoney(summary.returnedTotal, currency)}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Net sales</p><p className="mt-1 text-2xl font-black">{formatMoney(summary.netTotal, currency)}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Tracked stock value</p><p className="mt-1 text-2xl font-black">{formatMoney(valuation, currency)}</p></article>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Daily net sales">
          <div className="divide-y">
            {[...summary.daily.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, value]) => (
              <div key={day} className="flex justify-between p-4">
                <span>{day}<small className="ml-2 text-stone-500">{value.count} sales</small></span>
                <b>{formatMoney(value.net, currency)}</b>
              </div>
            ))}
            {summary.daily.size === 0 && empty("No sales in this period.")}
          </div>
        </Section>
        <Section title="Payment report (net)">
          <div className="divide-y">
            {paymentList.map(([method, row]) => (
              <div key={method} className="flex justify-between p-4">
                <span>{paymentLabel(method)} <small className="text-stone-500">({row.count})</small></span>
                <b>{formatMoney(row.net, currency)}</b>
              </div>
            ))}
            {paymentList.length === 0 && empty("No payments in this period.")}
          </div>
        </Section>
        <Section title="Product performance (net)">
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
        <Section title="Category performance (net)">
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
        <Section title="Inventory — tracked stock">
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
                <span>{row.category}<small className="text-stone-500">({row._count})</small></span>
                <b>{formatMoney(row._sum.amount?.toNumber() ?? 0, currency)}</b>
              </div>
            ))}
            {expenses.length === 0 && empty("No expenses in this period.")}
          </div>
        </Section>
      </div>
      <Section title="Stock-take history">
        <div className="overflow-x-auto">
          <StockTakeHistoryTable logs={stockTakes} />
        </div>
      </Section>
    </div>
  );
}
