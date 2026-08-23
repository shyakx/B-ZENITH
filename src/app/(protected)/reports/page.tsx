import type { ReactNode } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { StockTakeHistoryTable } from "@/components/stock-take-history";
import { requireUser } from "@/lib/authorization";
import { businessRoles } from "@/lib/roles";
import { sumBilliardAmounts } from "@/lib/billiard";
import { formatMoney, kigaliRange, paymentLabel } from "@/lib/datetime";
import { LOCATION_CODES, stockByLocation } from "@/lib/location-stock";
import { prisma } from "@/lib/prisma";
import { applyBilliardTotals, summarizeSales, type ReportSale } from "@/lib/reporting";
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
  await requireUser(businessRoles);
  const filters = await searchParams;
  const { fromDay, toDay, start, end } = kigaliRange(filters.from, filters.to, 0);
  const saleWhere = { status: { not: "VOIDED" as const }, createdAt: { gte: start, lt: end } };

  const [sales, expenses, billiardRows, movements, trackedProducts, transfers, stockTakes, settings] = await Promise.all([
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
    prisma.billiardDaySale.findMany({
      where: { businessDay: { gte: fromDay, lte: toDay } },
      include: { operator: { select: { name: true } } },
      orderBy: [{ businessDay: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.inventoryMovement.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { product: { select: { name: true } }, location: { select: { code: true } } },
    }),
    prisma.product.findMany({
      where: { trackInventory: true, active: true },
      orderBy: { name: "asc" },
      include: { locationStocks: { include: { location: { select: { code: true } } } } },
    }),
    prisma.stockTransfer.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        fromLocation: { select: { code: true } },
        toLocation: { select: { code: true } },
        lines: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.auditLog.findMany({
      where: { action: STOCK_TAKE_ACTION, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true } } },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);

  const billiardTotal = sumBilliardAmounts(billiardRows);
  const currency = settings?.currency ?? "RWF";
  const summary = applyBilliardTotals(
    summarizeSales(toReportSales(sales)),
    billiardRows.map((row) => ({ businessDay: row.businessDay, amount: row.amount.toNumber() })),
  );
  const productList = [...summary.products.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 50);
  const categoryList = [...summary.categories.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const paymentList = [...summary.payments.entries()];
  const locationCodes = [LOCATION_CODES.MAIN_STOCK, LOCATION_CODES.BAR, LOCATION_CODES.KITCHEN];
  const stockRows = trackedProducts.map((product) => {
    const qty = stockByLocation(product.locationStocks, locationCodes);
    const total = qty.MAIN_STOCK + qty.BAR + qty.KITCHEN;
    return { name: product.name, qty, total, reorderLevel: product.reorderLevel, costPrice: product.costPrice.toNumber() };
  });
  const lowStock = stockRows.filter((product) => product.total <= product.reorderLevel);
  const valuation = stockRows.reduce((sum, product) => sum + product.total * product.costPrice, 0);

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Performance</p>
        <h1 className="text-3xl font-black">Reports</h1>
        <p className="mt-1 text-sm text-stone-500">
          Defaults to today. Pick dates to look back. Net sales include billiard day totals.
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 print:hidden">
        <label className="text-sm font-bold">From<input name="from" type="date" defaultValue={fromDay} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-bold">To<input name="to" type="date" defaultValue={toDay} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" /></label>
        <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Apply</button>
      </form>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Gross sales</p><p className="mt-1 text-2xl font-black">{formatMoney(summary.grossTotal, currency)}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Returns</p><p className="mt-1 text-2xl font-black">{formatMoney(summary.returnedTotal, currency)}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Net sales</p><p className="mt-1 text-2xl font-black">{formatMoney(summary.netTotal, currency)}</p></article>
        <article className="rounded-lg border bg-white p-5"><p className="text-sm text-stone-500">Billiard</p><p className="mt-1 text-2xl font-black">{formatMoney(billiardTotal, currency)}</p></article>
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
        <Section title="Inventory — stock by location">
          <div className="max-h-[500px] divide-y overflow-y-auto">
            {stockRows.map((product) => (
              <div key={product.name} className="flex justify-between gap-3 p-4">
                <span>{product.name}</span>
                <span className="text-right text-sm">
                  Main {product.qty.MAIN_STOCK} · Bar {product.qty.BAR} · Kitchen {product.qty.KITCHEN} · <b>Total {product.total}</b>
                </span>
              </div>
            ))}
            {stockRows.length === 0 && empty("No products are currently tracking stock.")}
          </div>
        </Section>
        <Section title="Low stock (total across locations)">
          <div className="divide-y">
            {lowStock.map((product) => (
              <div key={product.name} className="flex justify-between p-4">
                <span>{product.name}</span>
                <b className="text-amber-700">{product.total}</b>
              </div>
            ))}
            {lowStock.length === 0 && empty("No low-stock products.")}
          </div>
        </Section>
        <Section title="Stock movements">
          <div className="max-h-[500px] divide-y overflow-y-auto">
            {movements.map((movement) => (
              <div key={movement.id} className="flex justify-between p-4">
                <span>
                  {movement.product.name}
                  <small className="ml-2 text-stone-500">{movement.type} · {movement.location?.code ?? "MAIN_STOCK"}</small>
                </span>
                <b className={movement.quantity < 0 ? "text-red-700" : "text-green-700"}>
                  {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                </b>
              </div>
            ))}
            {movements.length === 0 && empty("No stock movements in this period.")}
          </div>
        </Section>
        <Section title="Transfer history">
          <div className="max-h-[500px] divide-y overflow-y-auto">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="p-4">
                <p className="font-bold">{transfer.fromLocation.code} → {transfer.toLocation.code}</p>
                <p className="text-sm text-stone-500">
                  {transfer.lines.map((line) => `${line.quantity} × ${line.product.name}`).join(", ")}
                </p>
              </div>
            ))}
            {transfers.length === 0 && empty("No transfers in this period.")}
          </div>
        </Section>
        <Section title="Billiard day totals">
          <div className="divide-y">
            {billiardRows.map((row) => (
              <div key={row.id} className="flex justify-between p-4">
                <span>
                  {row.businessDay}
                  <small className="ml-2 text-stone-500">{row.operator.name}</small>
                </span>
                <b>{formatMoney(row.amount.toNumber(), currency)}</b>
              </div>
            ))}
            {billiardRows.length === 0 && empty("No billiard totals in this period.")}
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
