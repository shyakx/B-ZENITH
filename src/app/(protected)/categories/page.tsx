import { createCategory, updateCategory } from "@/actions/catalog";
import { requireUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export default async function CategoriesPage() {
  await requireUser(["OWNER", "ADMIN", "INVENTORY"]);
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Menu</p><h1 className="text-3xl font-black">Categories</h1></div>
      <form action={createCategory} className="flex gap-3 rounded-lg border bg-white p-4">
        <input required name="name" placeholder="New category name" className="min-h-11 flex-1 rounded-md border px-3" />
        <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Add</button>
      </form>
      <div className="space-y-3">
        {categories.map((category) => (
          <form key={category.id} action={updateCategory.bind(null, category.id)} className="grid items-center gap-3 rounded-lg border bg-white p-4 sm:grid-cols-[1fr_auto_auto]">
            <div><input required name="name" defaultValue={category.name} className="min-h-11 w-full rounded-md border px-3 font-bold" /><p className="mt-1 text-xs text-stone-500">{category._count.products} products</p></div>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked={category.active} /> Active</label>
            <button className="min-h-11 rounded-md border px-4 font-bold">Save</button>
          </form>
        ))}
      </div>
    </div>
  );
}
