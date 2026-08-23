import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { BilliardSalesForm } from "@/components/billiard-sales-form";
import { LiveRefresh } from "@/components/live-refresh";
import { requireUser } from "@/lib/authorization";
import { canViewLifetimeSales } from "@/lib/business-day";
import { businessRoles } from "@/lib/roles";
import { sumBilliardAmounts, billiardReceiptNumber } from "@/lib/billiard";
import { formatDateTime, formatMoney, kigaliDateString, paymentLabel, todayKigaliRange } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { applyBilliardTotals, summarizeSales } from "@/lib/reporting";

export default async function DashboardPage() {
  const user = await requireUser(businessRoles);
  const { start, end } = todayKigaliRange();
  const today = kigaliDateString();
  const todaySales = {
    status: { not: "VOIDED" as const },
    createdAt: { gte: start, lt: end },
  };

  const showLifetime = canViewLifetimeSales(user.role);

  const [sales, expenses, billiardRows, recent, recentBilliard, lowStock, settings, lifetimePos, lifetimeBilliard] = await Promise.all([
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
    prisma.billiardDaySale.findMany({
      where: { businessDay: today },
      select: { amount: true, note: true, operatorId: true },
    }),
    prisma.sale.findMany({
      where: todaySales,
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { cashier: { select: { name: true } } },
    }),
    prisma.billiardDaySale.findMany({
      where: { businessDay: today },
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: { operator: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { active: true, trackInventory: true },
      orderBy: { stockQuantity: "asc" },
      take: 50,
      select: { id: true, name: true, stockQuantity: true, reorderLevel: true },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
    showLifetime
      ? prisma.sale.aggregate({
          where: { status: { not: "VOIDED" } },
          _sum: { total: true },
          _count: true,
        })
      : Promise.resolve(null),
    showLifetime ? prisma.billiardDaySale.aggregate({ _sum: { amount: true } }) : Promise.resolve(null),
  ]);

  const currency = settings?.currency ?? "RWF";
  const posSummary = summarizeSales(
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
  const billiardToday = sumBilliardAmounts(billiardRows);
  const summary = applyBilliardTotals(
    posSummary,
    billiardRows.map((row) => ({ businessDay: today, amount: row.amount.toNumber() })),
  );
  const topItems = [...summary.products.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity || b[1].revenue - a[1].revenue)
    .slice(0, 5);
  const myBilliard = billiardRows.find((row) => row.operatorId === user.id);
  const recentFeed = [
    ...recent.map((sale) => ({
      id: sale.id,
      href: `/sales/${sale.id}`,
      title: sale.receiptNumber,
      staff: sale.cashier.name,
      at: sale.createdAt,
      method: paymentLabel(sale.paymentMethod),
      total: sale.total.toNumber(),
    })),
    ...recentBilliard.map((row) => ({
      id: row.id,
      href: `/sales/${row.id}`,
      title: billiardReceiptNumber(row.businessDay),
      staff: row.operator.name,
      at: row.updatedAt,
      method: "Billiard day total",
      total: row.amount.toNumber(),
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);
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
    ["Billiard today", formatMoney(billiardToday, currency)],
    ["Cash (net)", formatMoney(summary.payments.get("CASH")?.net ?? 0, currency)],
    ["Mobile money (net)", formatMoney(summary.payments.get("MOBILE_MONEY")?.net ?? 0, currency)],
    ["Card (net)", formatMoney(summary.payments.get("CARD")?.net ?? 0, currency)],
  ];

  return (
    <div className="space-y-7">
      <LiveRefresh />
      <div>
        <div className="mb-2 flex items-center gap-3">
          <BrandLogo size={48} className="rounded-md" />
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#947313]">B-ZENITH</p>
        </div>
        <h1 className="text-3xl font-black">Today&apos;s business</h1>
        <p className="mt-1 text-sm text-stone-500">
          Live Kigali day only. Closed days stay archived and can be opened from Sales → Closed days.
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
      {showLifetime && lifetimePos ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-lg border border-stone-200 bg-white p-5">
            <p className="text-sm font-semibold text-stone-500">All POS since start</p>
            <p className="mt-2 text-2xl font-black">{formatMoney(lifetimePos._sum.total?.toNumber() ?? 0, currency)}</p>
          </article>
          <article className="rounded-lg border border-stone-200 bg-white p-5">
            <p className="text-sm font-semibold text-stone-500">All POS tickets</p>
            <p className="mt-2 text-2xl font-black">{lifetimePos._count}</p>
          </article>
          <article className="rounded-lg border border-stone-200 bg-white p-5">
            <p className="text-sm font-semibold text-stone-500">All billiard since start</p>
            <p className="mt-2 text-2xl font-black">{formatMoney(lifetimeBilliard?._sum.amount?.toNumber() ?? 0, currency)}</p>
          </article>
        </section>
      ) : null}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Billiard sales</h2>
            <p className="text-sm text-stone-500">Save today’s total take. Games are not entered one by one.</p>
          </div>
          <Link href="/billiard" className="font-bold text-[#947313]">Open billiard</Link>
        </div>
        <BilliardSalesForm defaultAmount={myBilliard?.amount.toNumber()} defaultNote={myBilliard?.note ?? undefined} />
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
          <h2 className="text-xl font-black">Today’s transactions</h2>
          <Link href="/sales" className="font-bold text-[#947313]">View all</Link>
        </div>
        {recentFeed.length === 0 ? (
          <p className="p-8 text-center text-stone-500">No sales recorded yet.</p>
        ) : (
          <div className="divide-y">
            {recentFeed.map((sale) => (
              <Link key={sale.id} href={sale.href} className="grid gap-2 p-4 hover:bg-stone-50 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <b>{sale.title}</b>
                  <p className="text-sm text-stone-500">{sale.staff}</p>
                </div>
                <div className="text-sm">
                  <p>{formatDateTime(sale.at)}</p>
                  <p className="text-stone-500">{sale.method}</p>
                </div>
                <b>{formatMoney(sale.total, currency)}</b>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
