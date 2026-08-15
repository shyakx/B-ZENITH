import { Printer } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/authorization";
import { formatDateTime, formatMoney, kigaliRange, paymentLabel } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@prisma/client";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; payment?: string }>;
}) {
  const user = await requireUser(["OWNER", "ADMIN", "WAITER"]);
  const filters = await searchParams;
  const ranged = filters.from || filters.to;
  const range = ranged ? kigaliRange(filters.from, filters.to, 0) : null;
  const payment = filters.payment as PaymentMethod | undefined;
  const validPayment = payment && ["CASH", "CARD", "MOBILE_MONEY"].includes(payment) ? payment : undefined;

  const [sales, settings] = await Promise.all([
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
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);
  const currency = settings?.currency ?? "RWF";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Transactions</p>
        <h1 className="text-3xl font-black">Sales history</h1>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <label className="text-sm font-bold">Search
          <input name="q" defaultValue={filters.q} placeholder="Receipt or waiter" className="mt-1 block min-h-11 rounded-md border px-3 font-normal" />
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
      {sales.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">No transactions match your search.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Receipt</th>
                <th className="p-4">Date / time</th>
                <th className="p-4">Waiter</th>
                <th className="p-4">Payment</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="p-4 font-bold">
                    <Link href={`/sales/${sale.id}`} className="hover:underline">{sale.receiptNumber}</Link>
                  </td>
                  <td className="p-4">{formatDateTime(sale.createdAt)}</td>
                  <td className="p-4">{sale.cashier.name}</td>
                  <td className="p-4">{paymentLabel(sale.paymentMethod)}</td>
                  <td className="p-4">{sale.status.replaceAll("_", " ")}</td>
                  <td className="p-4 text-right font-bold">{formatMoney(sale.total.toNumber(), currency)}</td>
                  <td className="p-4">
                    <Link href={`/print/receipt/${sale.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 font-bold">
                      <Printer size={16} /> Receipt
                    </Link>
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
