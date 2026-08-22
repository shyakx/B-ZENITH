import { Printer } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/authorization";
import { billiardReceiptNumber } from "@/lib/billiard";
import { tillRoles } from "@/lib/roles";
import { formatDateTime, formatMoney, kigaliRange, paymentLabel } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@prisma/client";

type HistoryRow = {
  id: string;
  kind: "pos" | "billiard";
  receiptNumber: string;
  createdAt: Date;
  staffName: string;
  payment: string;
  status: string;
  total: number;
};

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; payment?: string }>;
}) {
  const user = await requireUser(tillRoles);
  const filters = await searchParams;
  const ranged = filters.from || filters.to;
  const range = ranged ? kigaliRange(filters.from, filters.to, 0) : null;
  const payment = filters.payment as PaymentMethod | undefined;
  const validPayment = payment && ["CASH", "CARD", "MOBILE_MONEY"].includes(payment) ? payment : undefined;
  const query = filters.q?.trim().toLowerCase() ?? "";
  const includeBilliard = user.role !== "WAITER" && user.role !== "BILLIARD" && !validPayment;

  const [sales, billiardRows, settings] = await Promise.all([
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
      include: { cashier: { select: { name: true } } },
    }),
    includeBilliard
      ? prisma.billiardDaySale.findMany({
          where: {
            ...(range ? { businessDay: { gte: range.fromDay, lte: range.toDay } } : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: 250,
          include: { operator: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);
  const currency = settings?.currency ?? "RWF";

  const rows: HistoryRow[] = [
    ...sales.map((sale) => ({
      id: sale.id,
      kind: "pos" as const,
      receiptNumber: sale.receiptNumber,
      createdAt: sale.createdAt,
      staffName: sale.cashier.name,
      payment: paymentLabel(sale.paymentMethod),
      status: sale.status.replaceAll("_", " "),
      total: sale.total.toNumber(),
    })),
    ...billiardRows
      .filter((row) => {
        if (!query) return true;
        const haystack = `${billiardReceiptNumber(row.businessDay)} ${row.operator.name} billiard billard`.toLowerCase();
        return haystack.includes(query);
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
      })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 250);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Transactions</p>
        <h1 className="text-3xl font-black">Sales history</h1>
        <p className="mt-1 text-sm text-stone-500">Billiard day totals appear here with POS receipts.</p>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <label className="text-sm font-bold">Search
          <input name="q" defaultValue={filters.q} placeholder="Receipt, waiter, or billiard" className="mt-1 block min-h-11 rounded-md border px-3 font-normal" />
        </label>
        <label className="text-sm font-bold">From<input name="from" type="date" defaultValue={filters.from} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-bold">To<input name="to" type="date" defaultValue={filters.to} className="mt-1 block min-h-11 rounded-md border px-3 font-normal" /></label>
        <label className="text-sm font-bold">Payment
          <select name="payment" defaultValue={filters.payment ?? ""} className="mt-1 block min-h-11 rounded-md border px-3 font-normal">
            <option value="">All methods</option>
            <option value="CASH">Cash</option>
            <option value="MOBILE_MONEY">Mobile money</option>
            <option value="CARD">Card</option>
          </select>
        </label>
        <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Filter</button>
        <Link href="/sales" className="grid min-h-11 place-items-center rounded-md border px-5 font-bold">Reset</Link>
      </form>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">No transactions match your search.</p>
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
                    <Link href={`/sales/${row.id}`} className="hover:underline">{row.receiptNumber}</Link>
                  </td>
                  <td className="p-4">{formatDateTime(row.createdAt)}</td>
                  <td className="p-4">{row.staffName}</td>
                  <td className="p-4">{row.payment}</td>
                  <td className="p-4">{row.status}</td>
                  <td className="p-4 text-right font-bold">{formatMoney(row.total, currency)}</td>
                  <td className="p-4">
                    {row.kind === "pos" ? (
                      <Link href={`/print/receipt/${row.id}?autoprint=1`} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 font-bold">
                        <Printer size={16} /> Receipt
                      </Link>
                    ) : (
                      <Link href={`/sales/${row.id}`} className="inline-flex min-h-11 items-center rounded-md border px-3 font-bold">
                        View
                      </Link>
                    )}
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
