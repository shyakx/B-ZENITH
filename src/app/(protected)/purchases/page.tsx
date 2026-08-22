import Link from "next/link";
import { PurchaseForm } from "@/components/purchase-form";
import { requireUser } from "@/lib/authorization";
import { formatDateTime, formatMoney } from "@/lib/datetime";
import { catalogRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export default async function PurchasesPage() {
  await requireUser(catalogRoles);
  const [suppliers, products, purchases, settings] = await Promise.all([
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.purchase.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { supplier: true, createdBy: { select: { name: true } }, _count: { select: { items: true } } },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);
  const currency = settings?.currency ?? "RWF";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Buying stock</p>
        <h1 className="text-3xl font-black">Stock in</h1>
        <p className="mt-2 text-sm text-stone-500">
          Record products bought from suppliers. Point of sale is for selling to customers.
        </p>
        <Link href="/suppliers" className="mt-2 inline-block text-sm font-bold text-[#947313]">
          Manage suppliers
        </Link>
      </div>
      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">Add menu products before recording a purchase.</p>
      ) : (
        <PurchaseForm suppliers={suppliers} products={products} />
      )}
      {purchases.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">No purchases found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Reference</th>
                <th className="p-4">Date</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Items</th>
                <th className="p-4">Staff</th>
                <th className="p-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="p-4 font-bold">
                    <Link href={`/purchases/${purchase.id}`} className="hover:underline">{purchase.referenceNumber}</Link>
                  </td>
                  <td className="p-4">{formatDateTime(purchase.createdAt)}</td>
                  <td className="p-4">{purchase.supplier?.name ?? "—"}</td>
                  <td className="p-4">{purchase._count.items}</td>
                  <td className="p-4">{purchase.createdBy.name}</td>
                  <td className="p-4 text-right font-bold">{formatMoney(purchase.total.toNumber(), currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
