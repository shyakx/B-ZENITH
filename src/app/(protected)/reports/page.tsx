import type { ReactNode } from "react";
import { DashboardHeader, StatCard, StatGrid } from "@/components/dashboard/ui";
import { LiveRefresh } from "@/components/live-refresh";
import { StockTakeHistoryTable } from "@/components/stock-take-history";
import { requireUser } from "@/lib/authorization";
import { businessRoles } from "@/lib/roles";
import { sumBilliardAmounts } from "@/lib/billiard";
import { formatMoney, kigaliRange, paymentLabel } from "@/lib/datetime";
import { locationLabel, movementTypeLabel } from "@/lib/inventory-totals";
import { LOCATION_CODES, stockByLocation } from "@/lib/location-stock";
import { prisma } from "@/lib/prisma";
import { applyBilliardTotals, summarizeSales, type ReportSale } from "@/lib/reporting";
import { loadHospitalityReport } from "@/lib/hospitality-reporting";
import { STOCK_TAKE_ACTION } from "@/lib/stock-take";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-x-auto rounded-lg border border-black bg-white">
      <h2 className="bz-section-title border-b border-black px-4 py-3">{title}</h2>
      {children}
    </section>
  );
}

function empty(text: string) {
  return <p className="p-8 text-center text-black">{text}</p>;
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
  const saleWhere = { status: { not:"VOIDED" as const }, createdAt: { gte: start, lt: end } };

  const [sales, expenses, billiardRows, movements, trackedProducts, transfers, stockTakes, settings, hospitality] = await Promise.all([
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
      orderBy: [{ businessDay:"desc" }, { updatedAt:"desc" }],
    }),
    prisma.inventoryMovement.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt:"desc" },
      take: 80,
      include: { product: { select: { name: true } }, location: { select: { code: true } } },
    }),
    prisma.product.findMany({
      where: { trackInventory: true, active: true },
      orderBy: { name:"asc" },
      include: { locationStocks: { include: { location: { select: { code: true } } } } },
    }),
    prisma.stockTransfer.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt:"desc" },
      take: 50,
      include: {
        fromLocation: { select: { code: true } },
        toLocation: { select: { code: true } },
        lines: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.auditLog.findMany({
      where: { action: STOCK_TAKE_ACTION, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt:"desc" },
      take: 100,
      include: { user: { select: { name: true } } },
    }),
    prisma.businessSettings.findUnique({ where: { id:"default" } }),
    loadHospitalityReport(start, end),
  ]);

  const billiardTotal = sumBilliardAmounts(billiardRows);
  const currency = settings?.currency ??"RWF";
  const summary = applyBilliardTotals(
    summarizeSales(toReportSales(sales)),
    billiardRows.map((row) => ({ businessDay: row.businessDay, amount: row.amount.toNumber() })),
  );
  const productList = [...summary.products.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 50);
  const categoryList = [...summary.categories.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const paymentList = [...hospitality.paymentTotals.entries()];
  const channelList = [...hospitality.channelTotals.entries()].sort((a, b) => b[1].total - a[1].total);
  const postedByList = [...hospitality.postedBy.entries()].sort((a, b) => b[1].items - a[1].items);
  const creditList = [...hospitality.credit.entries()];
  const adjustmentList = [...hospitality.adjustments.entries()];
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
      <DashboardHeader
        kicker="Analytics"
        title="Reports"
        subtitle="Financial totals come from finalized sales. Payment methods are summed from Payment records, not Sale.paymentMethod. Waiter performance uses round posters, not the current session waiter."
      />
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-black bg-white p-4 print:hidden">
        <label className="text-sm font-medium">From<input name="from " type="date" defaultValue={fromDay} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-medium">To<input name="to" type="date" defaultValue={toDay} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" /></label>
        <button className="bz-btn-primary">Apply</button>
      </form>
      <StatGrid columns={4}>
        <StatCard label="Gross sales" value={formatMoney(summary.grossTotal, currency)} />
        <StatCard label="Returns" value={formatMoney(summary.returnedTotal, currency)} />
        <StatCard label="Net sales" value={formatMoney(summary.netTotal, currency)} />
        <StatCard label="Billiard" value={formatMoney(billiardTotal, currency)} />
        <StatCard label="Tracked stock value" value={formatMoney(valuation, currency)} />
        <StatCard label="Financial sales" value={formatMoney(hospitality.financialTotal, currency)} />
        <StatCard label="Posted rounds (ops)" value={formatMoney(hospitality.operationalTotal, currency)} />
        <StatCard label="Location vs product stock" value={`${hospitality.inventory.locationStockSum} / ${hospitality.inventory.productStockSum}`} />
      </StatGrid>
      <h2 className="bz-section-title">Sales</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Daily net sales">
          <div className="divide-y divide-black">
            {[...summary.daily.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, value]) => (
              <div key={day} className="flex justify-between p-4">
                <span>{day}<small className="ml-2 text-black">{value.count} sales</small></span>
                <b>{formatMoney(value.net, currency)}</b>
              </div>
            ))}
            {summary.daily.size === 0 && empty("No sales in this period.")}
          </div>
        </Section>
        <Section title="Payment records (all methods)">
          <div className="divide-y divide-black">
            {paymentList.map(([method, row]) => (
              <div key={method} className="flex justify-between p-4">
                <span>{paymentLabel(method)} <small className="text-black">({row.count})</small></span>
                <b>{formatMoney(row.amount, currency)}</b>
              </div>
            ))}
            {paymentList.length === 0 && empty("No payment records in this period.")}
          </div>
        </Section>
        <Section title="Sales by channel">
          <div className="divide-y divide-black">
            {channelList.map(([channel, row]) => (
              <div key={channel} className="flex justify-between p-4">
                <span>{channel.replaceAll("_","")} <small className="text-black">({row.count})</small></span>
                <b>{formatMoney(row.total, currency)}</b>
              </div>
            ))}
            {channelList.length === 0 && empty("No settled hospitality sales in this period.")}
          </div>
        </Section>
        <Section title="Round posters (not current waiter)">
          <div className="divide-y divide-black">
            {postedByList.map(([id, row]) => (
              <div key={id} className="flex justify-between p-4">
                <span>{row.name}<small className="ml-2 text-black">{row.rounds} rounds · {row.items} items</small></span>
              </div>
            ))}
            {postedByList.length === 0 && empty("No posted rounds in this period.")}
          </div>
        </Section>
        <Section title="Settlement staff">
          <div className="divide-y divide-black">
            {[...hospitality.settlementStaff.entries()].map(([id, row]) => (
              <div key={id} className="flex justify-between p-4">
                <span>{row.name}</span>
                <b>{row.count}</b>
              </div>
            ))}
            {hospitality.settlementStaff.size === 0 && empty("No settlements in this period.")}
          </div>
        </Section>
        <Section title="Session openers">
          <div className="divide-y divide-black">
            {[...hospitality.sessionOpeners.entries()].map(([id, row]) => (
              <div key={id} className="flex justify-between p-4">
                <span>{row.name}</span>
                <b>{row.count}</b>
              </div>
            ))}
            {hospitality.sessionOpeners.size === 0 && empty("No sessions opened in this period.")}
          </div>
        </Section>
        <Section title="Fulfillment staff">
          <div className="divide-y divide-black">
            {[...hospitality.fulfillmentStaff.entries()].map(([id, row]) => (
              <div key={id} className="flex justify-between p-4">
                <span>{row.name}</span>
                <b>{row.count}</b>
              </div>
            ))}
            {hospitality.fulfillmentStaff.size === 0 && empty("No fulfillment transitions in this period.")}
          </div>
        </Section>
        <Section title="Adjustments">
          <div className="divide-y divide-black">
            {adjustmentList.map(([type, row]) => (
              <div key={type} className="flex justify-between p-4">
                <span>{type}<small className="ml-2 text-black">({row.count})</small></span>
                <b>× {row.quantity}</b>
              </div>
            ))}
            {adjustmentList.length === 0 && empty("No adjustments in this period.")}
          </div>
        </Section>
        <Section title="Credit bills">
          <div className="divide-y divide-black">
            {creditList.map(([status, row]) => (
              <div key={status} className="flex justify-between p-4">
                <span>{status.replaceAll("_","")} <small className="text-black">({row.count})</small></span>
                <b>{formatMoney(row.balance, currency)} due / {formatMoney(row.total, currency)}</b>
              </div>
            ))}
            {creditList.length === 0 && empty("No credit bills in this period.")}
          </div>
        </Section>
      </div>
      <h2 className="bz-section-title">Products</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Product performance (net)">
          <div className="max-h-[500px] divide-y overflow-y-auto">
            {productList.map(([name, value]) => (
              <div key={name} className="flex justify-between p-4">
                <span>{name}<small className="ml-2 text-black">× {value.quantity}</small></span>
                <b>{formatMoney(value.revenue, currency)}</b>
              </div>
            ))}
            {productList.length === 0 && empty("No product sales in this period.")}
          </div>
        </Section>
        <Section title="Category performance (net)">
          <div className="divide-y divide-black">
            {categoryList.map(([name, value]) => (
              <div key={name} className="flex justify-between p-4">
                <span>{name}<small className="ml-2 text-black">× {value.quantity}</small></span>
                <b>{formatMoney(value.revenue, currency)}</b>
              </div>
            ))}
            {categoryList.length === 0 && empty("No category sales in this period.")}
          </div>
        </Section>
      </div>
      <h2 className="bz-section-title">Stock</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Stock activity by type">
          <div className="divide-y divide-black">
            {hospitality.inventory.movements.map((row) => (
              <div key={row.type} className="flex justify-between p-4">
                <span>{movementTypeLabel(row.type)}<small className="ml-2 text-black">({row.count})</small></span>
                <b>{row.quantity > 0 ?"+" :""}{row.quantity}</b>
              </div>
            ))}
            {hospitality.inventory.movements.length === 0 && empty("No stock activity in this period.")}
          </div>
        </Section>
        <Section title="Stock by location">
          <div className="max-h-[500px] divide-y overflow-y-auto">
            {stockRows.map((product) => (
              <div key={product.name} className="flex justify-between gap-3 p-4">
                <span>{product.name}</span>
                <span className="text-right text-sm">
                  Main Store {product.qty.MAIN_STOCK} · Bar {product.qty.BAR} · Kitchen {product.qty.KITCHEN} · <b>Total {product.total}</b>
                </span>
              </div>
            ))}
            {stockRows.length === 0 && empty("No products are currently tracking stock.")}
          </div>
        </Section>
        <Section title="Low stock (total across locations)">
          <div className="divide-y divide-black">
            {lowStock.map((product) => (
              <div key={product.name} className="flex justify-between p-4">
                <span>{product.name}</span>
                <b className="text-black">{product.total}</b>
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
                  <small className="ml-2 text-black">{movementTypeLabel(movement.type)} · {locationLabel(movement.location?.code ??"MAIN_STOCK")}</small>
                </span>
                <b className={movement.quantity < 0 ?"text-black" :"text-black"}>
                  {movement.quantity > 0 ?"+" :""}{movement.quantity}
                </b>
              </div>
            ))}
            {movements.length === 0 && empty("No stock movements in this period.")}
          </div>
        </Section>
        <Section title="Move stock history">
          <div className="max-h-[500px] divide-y overflow-y-auto">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="p-4">
                <p className="font-medium">{locationLabel(transfer.fromLocation.code)} → {locationLabel(transfer.toLocation.code)}</p>
                <p className="text-sm text-black">
                  {transfer.lines.map((line) => `${line.quantity} × ${line.product.name}`).join(",")}
                </p>
              </div>
            ))}
            {transfers.length === 0 && empty("No stock moves in this period.")}
          </div>
        </Section>
        <Section title="Billiard day totals">
          <div className="divide-y divide-black">
            {billiardRows.map((row) => (
              <div key={row.id} className="flex justify-between p-4">
                <span>
                  {row.businessDay}
                  <small className="ml-2 text-black">{row.operator.name}</small>
                </span>
                <b>{formatMoney(row.amount.toNumber(), currency)}</b>
              </div>
            ))}
            {billiardRows.length === 0 && empty("No billiard totals in this period.")}
          </div>
        </Section>
        <Section title="Expenses">
          <div className="divide-y divide-black">
            {expenses.map((row) => (
              <div key={row.category} className="flex justify-between p-4">
                <span>{row.category}<small className="text-black">({row._count})</small></span>
                <b>{formatMoney(row._sum.amount?.toNumber() ?? 0, currency)}</b>
              </div>
            ))}
            {expenses.length === 0 && empty("No expenses in this period.")}
          </div>
        </Section>
      </div>
      <Section title="Count stock history">
        <div className="overflow-x-auto">
          <StockTakeHistoryTable logs={stockTakes} />
        </div>
      </Section>
    </div>
  );
}
