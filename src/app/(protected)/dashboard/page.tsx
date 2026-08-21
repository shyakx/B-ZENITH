import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { requireUser } from "@/lib/authorization";
import { formatDateTime, formatMoney, paymentLabel, todayKigaliRange } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { summarizeSales } from "@/lib/reporting";

export default async function DashboardPage() {
  await requireUser(["OWNER", "ADMIN"]);
  const { start, end } = todayKigaliRange();
  const todaySales = {
    status: { not: "VOIDED" as const },
    createdAt: { gte: start, lt: end },
  };

  const [sales, expenses, recent, lowStock, settings] = await Promise.all([
    prisma.sale.findMany({
      where: todaySales,
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
          },
        },
      },
    }),
    prisma.expense.aggregate({
      where: { incurredAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.sale.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { cashier: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { active: true, trackInventory: true },
      orderBy: { stockQuantity: "asc" },
      take: 50,
      select: { id: true, name: true, stockQuantity: true, reorderLevel: true },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);

  const currency = settings?.currency ?? "RWF";
  const summary = summarizeSales(
    sales.map((sale) => ({
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
      })),
    })),
  );
  const topItems = [...summary.products.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity || b[1].revenue - a[1].revenue)
    .slice(0, 5);
  const threshold = settings?.defaultReorderLevel ?? 5;
  const lowStockItems =
    settings?.lowStockEnabled === false
      ? []
      : lowStock.filter((product) => product.stockQuantity <= (product.reorderLevel || threshold)).slice(0, 8);
  const cards = [
    ["Gross sales", formatMoney(summary.grossTotal, currency)],
    ["Returns", formatMoney(summary.returnedTotal, currency)],
    ["Net sales", formatMoney(summary.netTotal, currency)],
    ["Transactions", String(summary.count)],
    ["Average net sale", formatMoney(summary.averageNet, currency)],
    ["Today's expenses", formatMoney(expenses._sum.amount?.toNumber() ?? 0, currency)],
    ["Cash (net)", formatMoney(summary.payments.get("CASH")?.net ?? 0, currency)],
    ["Mobile money (net)", formatMoney(summary.payments.get("MOBILE_MONEY")?.net ?? 0, currency)],
    ["Card (net)", formatMoney(summary.payments.get("CARD")?.net ?? 0, currency)],
  ];

  return (
    <div className="space-y-7">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <BrandLogo size={48} className="rounded-md" />
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#947313]">B-ZENITH</p>
        </div>
        <h1 className="text-3xl font-black">Today&apos;s business</h1>
        <p className="mt-1 text-sm text-stone-500">
          Net figures subtract returned items at original prices. Receipt totals are unchanged.
        </p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-lg border border-stone-200 bg-white p-5">
            <p className="text-sm font-semibold text-stone-500">{label}</p>
            <p className="mt-2 text-2xl font-black">{value}</p>
          </article>
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white">
          <h2 className="border-b p-5 text-xl font-black">Top-selling products today</h2>
          {topItems.length === 0 ? (
            <p className="p-8 text-center text-stone-500">No sales recorded today.</p>
          ) : (
            <div className="divide-y">
              {topItems.map(([name, item]) => (
                <div key={name} className="flex justify-between gap-3 p-4">
                  <div>
                    <b>{name}</b>
                    <p className="text-sm text-stone-500">× {item.quantity}</p>
                  </div>
                  <b>{formatMoney(item.revenue, currency)}</b>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="text-xl font-black">Low stock</h2>
            <Link href="/inventory" className="font-bold text-[#947313]">Inventory</Link>
          </div>
          {lowStockItems.length === 0 ? (
            <p className="p-8 text-center text-stone-500">No low-stock products.</p>
          ) : (
            <div className="divide-y">
              {lowStockItems.map((product) => (
                <div key={product.id} className="flex justify-between p-4">
                  <b>{product.name}</b>
                  <span className="font-bold text-amber-700">{product.stockQuantity} left</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-xl font-black">Recent transactions</h2>
          <Link href="/sales" className="font-bold text-[#947313]">View all</Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-8 text-center text-stone-500">No sales recorded yet.</p>
        ) : (
          <div className="divide-y">
            {recent.map((sale) => (
              <Link key={sale.id} href={`/sales/${sale.id}`} className="grid gap-2 p-4 hover:bg-stone-50 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <b>{sale.receiptNumber}</b>
                  <p className="text-sm text-stone-500">{sale.cashier.name}</p>
                </div>
                <div className="text-sm">
                  <p>{formatDateTime(sale.createdAt)}</p>
                  <p className="text-stone-500">{paymentLabel(sale.paymentMethod)}</p>
                </div>
                <b>{formatMoney(sale.total.toNumber(), currency)}</b>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
