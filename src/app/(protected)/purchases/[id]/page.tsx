import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authorization";
import { formatDateTime, formatMoney } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["OWNER", "ADMIN", "INVENTORY"]);
  const { id } = await params;
  const [purchase, settings] = await Promise.all([
    prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!purchase) notFound();
  const currency = settings?.currency ?? "RWF";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/purchases" className="text-sm font-bold text-[#947313]">← Purchases</Link>
        <h1 className="mt-2 text-3xl font-black">{purchase.referenceNumber}</h1>
        <p className="text-sm text-stone-500">
          {formatDateTime(purchase.createdAt)} · {purchase.createdBy.name} · {purchase.status}
        </p>
      </div>
      <section className="grid gap-4 rounded-lg border bg-white p-5 sm:grid-cols-2">
        <div><p className="text-sm text-stone-500">Supplier</p><b>{purchase.supplier?.name ?? "No supplier"}</b></div>
        <div><p className="text-sm text-stone-500">Total</p><b>{formatMoney(purchase.total.toNumber(), currency)}</b></div>
      </section>
      <section className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-stone-100">
            <tr>
              <th className="p-4">Product</th>
              <th className="p-4">Qty</th>
              <th className="p-4 text-right">Cost</th>
              <th className="p-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {purchase.items.map((item) => (
              <tr key={item.id}>
                <td className="p-4 font-bold">{item.product.name}</td>
                <td className="p-4">{item.quantity}</td>
                <td className="p-4 text-right">{formatMoney(item.unitCost.toNumber(), currency)}</td>
                <td className="p-4 text-right font-bold">{formatMoney(item.total.toNumber(), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
