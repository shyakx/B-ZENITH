import { createSupplier, updateSupplier } from "@/actions/suppliers";
import { requireUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const Fields = ({ supplier }: { supplier?: { name: string; phone: string | null; email: string | null; address: string | null; active: boolean } }) => (
  <>
    <input required name="name" defaultValue={supplier?.name} placeholder="Supplier name" className="min-h-11 rounded-md border px-3" />
    <input name="phone" defaultValue={supplier?.phone ?? ""} placeholder="Phone" className="min-h-11 rounded-md border px-3" />
    <input name="email" type="email" defaultValue={supplier?.email ?? ""} placeholder="Email" className="min-h-11 rounded-md border px-3" />
    <input name="address" defaultValue={supplier?.address ?? ""} placeholder="Address" className="min-h-11 rounded-md border px-3" />
    <label className="flex items-center gap-2 font-bold"><input name="active" type="checkbox" defaultChecked={supplier?.active ?? true} /> Active</label>
  </>
);

export default async function SuppliersPage() {
  await requireUser(["OWNER", "ADMIN", "INVENTORY"]);
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <div><p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Purchasing</p><h1 className="text-3xl font-black">Suppliers</h1></div>
      <details className="rounded-lg border bg-white"><summary className="min-h-14 cursor-pointer p-4 font-black">Add supplier</summary><form action={createSupplier} className="grid gap-3 border-t p-4 md:grid-cols-2"><Fields /><button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37] md:col-span-2">Create supplier</button></form></details>
      <div className="grid gap-3 xl:grid-cols-2">
        {suppliers.map((supplier) => (
          <form key={supplier.id} action={updateSupplier.bind(null, supplier.id)} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
            <Fields supplier={supplier} />
            <button className="min-h-11 rounded-md border px-5 font-bold">Save changes</button>
          </form>
        ))}
        {suppliers.length === 0 && <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">No suppliers yet.</p>}
      </div>
    </div>
  );
}
