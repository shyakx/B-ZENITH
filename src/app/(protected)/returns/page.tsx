import { ReturnForm } from "@/components/return-form";
import { requireUser } from "@/lib/authorization";
import { formatDateTime, formatMoney } from "@/lib/datetime";
import { businessRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string }>;
}) {
  await requireUser(businessRoles);
  const { receipt } = await searchParams;
  const sale = receipt
    ? await prisma.sale.findUnique({
        where: { receiptNumber: receipt },
        include: { items: true, cashier: { select: { name: true } } },
      })
    : null;
  const returns = await prisma.return.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: { sale: { select: { receiptNumber: true } }, createdBy: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Sales</p><h1 className="text-3xl font-black">Returns</h1></div>
      <form className="flex gap-3 rounded-lg border bg-white p-4"><input required name="receipt" defaultValue={receipt} placeholder="Receipt number" className="min-h-11 flex-1 rounded-md border px-3" /><button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Find sale</button></form>
      {receipt && !sale && <p className="rounded-md bg-red-50 p-4 font-bold text-red-700">Sale not found.</p>}
      {sale && (
        <section className="rounded-lg border bg-white p-5">
          <div className="mb-5 flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-black">{sale.receiptNumber}</h2><p className="text-sm text-stone-500">{formatDateTime(sale.createdAt)} · {sale.cashier.name}</p></div><b>{formatMoney(sale.total.toNumber())}</b></div>
          {["COMPLETED", "PARTIALLY_RETURNED"].includes(sale.status) ? <ReturnForm saleId={sale.id} items={sale.items.filter((item) => item.quantity > item.returnedQuantity).map((item) => ({ id: item.id, name: item.productName, available: item.quantity - item.returnedQuantity, unitPrice: item.unitPrice.toFixed(2) }))} /> : <p className="font-bold text-amber-700">This sale cannot be returned ({sale.status}).</p>}
        </section>
      )}
      <section className="rounded-lg border bg-white"><h2 className="border-b p-4 text-xl font-black">Recent returns</h2><div className="divide-y">{returns.map((item) => <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_auto]"><div><b>{item.returnNumber}</b><p className="text-sm text-stone-500">{item.sale.receiptNumber}</p></div><div>{formatDateTime(item.createdAt)}<p className="text-sm text-stone-500">{item.createdBy.name}</p></div><b>{formatMoney(item.total.toNumber())}</b></div>)}{returns.length === 0 && <p className="p-8 text-center text-stone-500">No returns recorded.</p>}</div></section>
    </div>
  );
}
