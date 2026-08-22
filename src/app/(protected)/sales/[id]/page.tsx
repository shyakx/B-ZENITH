import { Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authorization";
import { billiardReceiptNumber } from "@/lib/billiard";
import { tillRoles } from "@/lib/roles";
import { formatDateTime, formatMoney, paymentLabel } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(tillRoles);
  const { id } = await params;
  const [sale, billiard, settings] = await Promise.all([
    prisma.sale.findFirst({
      where: {
        id,
        ...(user.role === "WAITER" ? { cashierId: user.id } : {}),
      },
      include: { cashier: { select: { name: true } }, items: true, payment: true },
    }),
    user.role === "WAITER"
      ? Promise.resolve(null)
      : prisma.billiardDaySale.findUnique({
          where: { id },
          include: { operator: { select: { name: true } } },
        }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);
  const currency = settings?.currency ?? "RWF";

  if (billiard && !sale) {
    const amount = billiard.amount.toNumber();
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/sales" className="text-sm font-bold text-[#947313]">← Sales history</Link>
          <h1 className="mt-2 text-3xl font-black">{billiardReceiptNumber(billiard.businessDay)}</h1>
          <p className="text-sm text-stone-500">{formatDateTime(billiard.updatedAt)} · {billiard.operator.name}</p>
        </div>
        <section className="grid gap-4 rounded-lg border bg-white p-5 sm:grid-cols-3">
          <div><p className="text-sm text-stone-500">Type</p><b>Billiard day total</b></div>
          <div><p className="text-sm text-stone-500">Business day</p><b>{billiard.businessDay}</b></div>
          <div><p className="text-sm text-stone-500">Total</p><b>{formatMoney(amount, currency)}</b></div>
        </section>
        <section className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Item</th>
                <th className="p-4">Note</th>
                <th className="p-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 font-bold">Billiard sales</td>
                <td className="p-4 text-stone-500">{billiard.note || "Day total — games not listed"}</td>
                <td className="p-4 text-right font-bold">{formatMoney(amount, currency)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    );
  }

  if (!sale) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/sales" className="text-sm font-bold text-[#947313]">← Sales history</Link>
          <h1 className="mt-2 text-3xl font-black">{sale.receiptNumber}</h1>
          <p className="text-sm text-stone-500">{formatDateTime(sale.createdAt)} · {sale.cashier.name}</p>
        </div>
        <Link href={`/print/receipt/${sale.id}?autoprint=1`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-black px-4 font-bold text-[#d4af37]">
          <Printer size={16} /> Print receipt
        </Link>
      </div>
      <section className="grid gap-4 rounded-lg border bg-white p-5 sm:grid-cols-3">
        <div><p className="text-sm text-stone-500">Payment</p><b>{paymentLabel(sale.paymentMethod)}</b></div>
        <div><p className="text-sm text-stone-500">Status</p><b>{sale.status.replaceAll("_", " ")}</b></div>
        <div><p className="text-sm text-stone-500">Total</p><b>{formatMoney(sale.total.toNumber(), currency)}</b></div>
      </section>
      <section className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-stone-100">
            <tr>
              <th className="p-4">Item</th>
              <th className="p-4">Unit</th>
              <th className="p-4">Qty</th>
              <th className="p-4 text-right">Price</th>
              <th className="p-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sale.items.map((item) => (
              <tr key={item.id}>
                <td className="p-4 font-bold">{item.productName}</td>
                <td className="p-4">{item.variantName ?? "—"}</td>
                <td className="p-4">{item.quantity}</td>
                <td className="p-4 text-right">{formatMoney(item.unitPrice.toNumber(), currency)}</td>
                <td className="p-4 text-right font-bold">{formatMoney(item.lineSubtotal.toNumber(), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="space-y-2 rounded-lg border bg-white p-5 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><b>{formatMoney(sale.subtotal.toNumber(), currency)}</b></div>
        {sale.tax.isPositive() && <div className="flex justify-between"><span>Tax</span><b>{formatMoney(sale.tax.toNumber(), currency)}</b></div>}
        <div className="flex justify-between text-lg"><span className="font-black">Total</span><b>{formatMoney(sale.total.toNumber(), currency)}</b></div>
      </section>
    </div>
  );
}
