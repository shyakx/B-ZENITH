import { Printer } from "lucide-react";
import Link from "next/link";
import { CloseDayForm } from "@/components/close-day-form";
import { DeleteSaleButton } from "@/components/delete-sale-button";
import { LiveRefresh } from "@/components/live-refresh";
import { StatCards } from "@/components/stat-cards";
import { requireUser } from "@/lib/authorization";
import { billiardReceiptNumber } from "@/lib/billiard";
import { canCloseBusinessDay, canDeleteTransactions, canViewLifetimeSales } from "@/lib/business-day";
import { formatDateTime, formatMoney, kigaliDateString, kigaliRange, paymentLabel, todayKigaliRange } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { applyBilliardTotals, summarizeSales } from "@/lib/reporting";
import { tillRoles } from "@/lib/roles";
import type { PaymentMethod } from "@prisma/client";

export const dynamic = "force-dynamic";

type HistoryRow = {
  id: string;
  kind: "pos" | "billiard";
  receiptNumber: string;
  createdAt: Date;
  staffName: string;
  payment: string;
  status: string;
  total: number;
  canDelete: boolean;
};

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; payment?: string; view?: string }>;
}) {
  const user = await requireUser(tillRoles);
  const filters = await searchParams;
  const lifetime = canViewLifetimeSales(user.role);
  const viewAll = lifetime && filters.view === "all";
  const ranged = Boolean(filters.from || filters.to);
  const today = kigaliDateString();
  const range = viewAll
    ? null
    : ranged && lifetime
      ? kigaliRange(filters.from, filters.to, 0)
      : { ...todayKigaliRange(), fromDay: today, toDay: today };
  const payment = filters.payment as PaymentMethod | undefined;
  const validPayment = payment && ["CASH", "CARD", "MOBILE_MONEY"].includes(payment) ? payment : undefined;
  const query = filters.q?.trim().toLowerCase() ?? "";
  const includeBilliard = user.role !== "WAITER" && user.role !== "BILLIARD" && !validPayment;
  const showDelete = canDeleteTransactions(user.role);

  const [sales, billiardRows, expenses, todayClose, settings] = await Promise.all([
    prisma.sale.findMany({
      where: {
        ...(user.role === "WAITER" ? { cashierId: user.id } : {}),
        ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}),
        ...(validPayment ? { paymentMethod: validPayment } : {}),
        ...(filters.q
          ? {
              OR: [
                { receiptNumber: { contains: filters.q, mode: "insensitive" } },
                { cashier: { name: { contains: filters.q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 250,
      include: {
        cashier: { select: { name: true } },
        items: { select: { productName: true, quantity: true, returnedQuantity: true, lineSubtotal: true } },
        payments: { select: { method: true, amount: true } },
      },
    }),
    includeBilliard
      ? prisma.billiardDaySale.findMany({
          where: range ? { businessDay: { gte: range.fromDay, lte: range.toDay } } : {},
          orderBy: { updatedAt: "desc" },
          take: 250,
          include: { operator: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.expense.aggregate({
      where: range ? { incurredAt: { gte: range.start, lt: range.end } } : {},
      _sum: { amount: true },
    }),
    prisma.businessDayClose.findUnique({ where: { businessDay: today } }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);
  const currency = settings?.currency ?? "RWF";

  const closedDays = new Set(
    (
      await prisma.businessDayClose.findMany({
        where: { businessDay: { in: [...new Set(sales.map((sale) => kigaliDateString(sale.createdAt)))] } },
        select: { businessDay: true },
      })
    ).map((row) => row.businessDay),
  );

  const liveSales = sales.filter((sale) => sale.status !== "VOIDED");
  const summary = applyBilliardTotals(
    summarizeSales(
      liveSales.map((sale) => ({
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
    ),
    billiardRows.map((row) => ({ businessDay: row.businessDay, amount: row.amount.toNumber() })),
  );

  const rows: HistoryRow[] = [
    ...sales.map((sale) => ({
      id: sale.id,
      kind: "pos" as const,
      receiptNumber: sale.receiptNumber,
      createdAt: sale.createdAt,
      staffName: sale.cashier.name,
      payment: sale.payments.map(p => paymentLabel(p.method)).join(", ") || paymentLabel(sale.paymentMethod),
      status: sale.status.replaceAll("_", " "),
      total: sale.total.toNumber(),
      canDelete: showDelete && sale.status === "COMPLETED" && !closedDays.has(kigaliDateString(sale.createdAt)),
    })),
    ...billiardRows
      .filter((row) => {
        if (!query) return true;
        return `${billiardReceiptNumber(row.businessDay)} ${row.operator.name} billiard`.toLowerCase().includes(query);
      })
      .map((row) => ({
        id: row.id,
        kind: "billiard" as const,
        receiptNumber: billiardReceiptNumber(row.businessDay),
        createdAt: row.updatedAt,
        staffName: row.operator.name,
        payment: "Day total",
        status: "Billiard",
        total: row.amount.toNumber(),
        canDelete: showDelete && !closedDays.has(row.businessDay),
      })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 250);

  const heading = viewAll ? "All sales" : ranged && lifetime && range ? `${range.fromDay} – ${range.toDay}` : "Today’s sales";

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Transactions</p>
          <h1 className="text-3xl font-black">{heading}</h1>
          <p className="mt-1 text-sm text-stone-500">
            Figures refresh live for the current day. Closed days are kept and can be opened again from the archive.
          </p>
        </div>
        {lifetime ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/sales" className={`min-h-11 rounded-md px-4 font-bold ${viewAll || ranged ? "border" : "bg-black text-[#d4af37]"}`}>
              Today
            </Link>
            <Link href="/sales?view=all" className={`min-h-11 rounded-md px-4 font-bold ${viewAll ? "bg-black text-[#d4af37]" : "border"}`}>
              Since start
            </Link>
            <Link href="/sales/archive" className="grid min-h-11 place-items-center rounded-md border px-4 font-bold">
              Closed days
            </Link>
          </div>
        ) : null}
      </div>
      <StatCards
        currency={currency}
        cards={[
          { label: "Net sales", value: summary.netTotal, money: true },
          { label: "Transactions", value: String(summary.count) },
          { label: "Billiard", value: billiardRows.reduce((sum, row) => sum + row.amount.toNumber(), 0), money: true },
          { label: "Expenses", value: expenses._sum.amount?.toNumber() ?? 0, money: true },
        ]}
      />
      {canCloseBusinessDay(user.role) && !viewAll && !ranged ? (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-lg font-black">Close today</h2>
          <p className="mb-3 text-sm text-stone-500">
            Archive today’s totals so the team can come back to them later. The dashboard still follows the live Kigali day.
          </p>
          <CloseDayForm businessDay={today} alreadyClosed={Boolean(todayClose)} />
        </section>
      ) : null}
      {lifetime ? (
        <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
          <label className="text-sm font-bold">
            Search
            <input name="q" defaultValue={filters.q} placeholder="Receipt, waiter, or billiard" className="mt-1 block min-h-11 rounded-md border px-3 font-normal" />
          </label>
          <label className="text-sm font-bold">
            From
            <input name="from" type="date" defaultValue={filters.from} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" />
          </label>
          <label className="text-sm font-bold">
            To
            <input name="to" type="date" defaultValue={filters.to} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" />
          </label>
          <label className="text-sm font-bold">
            Payment
            <select name="payment" defaultValue={filters.payment ?? ""} className="mt-1 block min-h-11 rounded-md border px-3 font-normal">
              <option value="">All methods</option>
              <option value="CASH">Cash</option>
              <option value="MOBILE_MONEY">Mobile money</option>
              <option value="CARD">Card</option>
            </select>
          </label>
          <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Filter</button>
          <Link href="/sales" className="grid min-h-11 place-items-center rounded-md border px-5 font-bold">
            Reset
          </Link>
        </form>
      ) : (
        <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
          <label className="text-sm font-bold">
            Search
            <input name="q" defaultValue={filters.q} placeholder="Receipt" className="mt-1 block min-h-11 rounded-md border px-3 font-normal" />
          </label>
          <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Search</button>
        </form>
      )}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">No transactions in this view.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Receipt</th>
                <th className="p-4">Date / time</th>
                <th className="p-4">Staff</th>
                <th className="p-4">Payment</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={`${row.kind}-${row.id}`}>
                  <td className="p-4 font-bold">
                    <Link href={`/sales/${row.id}`} className="hover:underline">
                      {row.receiptNumber}
                    </Link>
                  </td>
                  <td className="p-4">{formatDateTime(row.createdAt)}</td>
                  <td className="p-4">{row.staffName}</td>
                  <td className="p-4">{row.payment}</td>
                  <td className="p-4">{row.status}</td>
                  <td className="p-4 text-right font-bold">{formatMoney(row.total, currency)}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {row.kind === "pos" ? (
                        <Link href={`/print/receipt/${row.id}?autoprint=1`} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 font-bold">
                          <Printer size={16} /> Receipt
                        </Link>
                      ) : (
                        <Link href={`/sales/${row.id}`} className="inline-flex min-h-11 items-center rounded-md border px-3 font-bold">
                          View
                        </Link>
                      )}
                      {row.canDelete ? <DeleteSaleButton id={row.id} kind={row.kind} label={row.receiptNumber} /> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
