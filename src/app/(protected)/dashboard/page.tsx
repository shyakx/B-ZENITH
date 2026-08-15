import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { requireUser } from "@/lib/authorization";
import { formatDateTime, formatMoney, paymentLabel, todayKigaliRange } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  await requireUser(["OWNER", "ADMIN"]);
  const { start, end } = todayKigaliRange();
  const todaySales = {
    status: { not: "VOIDED" as const },
    createdAt: { gte: start, lt: end },
  };

  const [summary, expenses, paymentGroups, recent, topItems, lowStock, settings] = await Promise.all([
    prisma.sale.aggregate({ where: todaySales, _sum: { total: true }, _count: true }),
    prisma.expense.aggregate({
      where: { incurredAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: todaySales,
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { cashier: { select: { name: true } } },
    }),
    prisma.saleItem.groupBy({
      by: ["productName"],
      where: { sale: todaySales },
      _sum: { quantity: true, lineSubtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
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
  const revenue = summary._sum.total?.toNumber() ?? 0;
  const count = summary._count;
  const average = count > 0 ? revenue / count : 0;
  const payments = new Map(paymentGroups.map((group) => [group.paymentMethod, group._sum.total?.toNumber() ?? 0]));
  const threshold = settings?.defaultReorderLevel ?? 5;
  const lowStockItems =
    settings?.lowStockEnabled === false
      ? []
      : lowStock.filter((product) => product.stockQuantity <= (product.reorderLevel || threshold)).slice(0, 8);
  const cards = [
    ["Today's sales", formatMoney(revenue, currency)],
    ["Transactions", String(count)],
    ["Average sale", formatMoney(average, currency)],
    ["Today's expenses", formatMoney(expenses._sum.amount?.toNumber() ?? 0, currency)],
    ["Cash", formatMoney(payments.get("CASH") ?? 0, currency)],
    ["Mobile money", formatMoney(payments.get("MOBILE_MONEY") ?? 0, currency)],
    ["Card", formatMoney(payments.get("CARD") ?? 0, currency)],
  ];

  return (
    <div className="space-y-7">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <BrandLogo size={48} className="rounded-md" />
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#947313]">B-ZENITH</p>
        </div>
        <h1 className="text-3xl font-black">Today&apos;s business</h1>
        <p className="mt-1 text-sm text-stone-500">Figures are live from PostgreSQL, Africa/Kigali time.</p>
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
              {topItems.map((item) => (
                <div key={item.productName} className="flex justify-between gap-3 p-4">
                  <div>
                    <b>{item.productName}</b>
                    <p className="text-sm text-stone-500">× {item._sum.quantity ?? 0}</p>
                  </div>
                  <b>{formatMoney(item._sum.lineSubtotal?.toNumber() ?? 0, currency)}</b>
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
