import { createExpense } from "@/actions/expenses";
import { requireUser } from "@/lib/authorization";
import { formatDate, formatMoney } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export default async function ExpensesPage() {
  await requireUser(["OWNER", "ADMIN"]);
  const expenses = await prisma.expense.findMany({
    take: 250,
    orderBy: { incurredAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return (
    <div className="space-y-6">
      <div><p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Operations</p><h1 className="text-3xl font-black">Expenses</h1></div>
      <form action={createExpense} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[1fr_2fr_1fr_1fr_auto]">
        <select name="category" className="min-h-11 rounded-md border px-3">{["Rent", "Utilities", "Transport", "Supplies", "Maintenance", "Other"].map((category) => <option key={category}>{category}</option>)}</select>
        <input required name="description" minLength={3} placeholder="Description" className="min-h-11 rounded-md border px-3" />
        <input required name="amount" type="number" min="1" step="0.01" placeholder="Amount RWF" className="min-h-11 rounded-md border px-3" />
        <input required name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="min-h-11 rounded-md border px-3" />
        <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Record</button>
      </form>
      <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-stone-100"><tr><th className="p-4">Date</th><th className="p-4">Category</th><th className="p-4">Description</th><th className="p-4">Created by</th><th className="p-4 text-right">Amount</th></tr></thead><tbody className="divide-y">{expenses.map((expense) => <tr key={expense.id}><td className="p-4">{formatDate(expense.incurredAt)}</td><td className="p-4 font-bold">{expense.category}</td><td className="p-4">{expense.description}</td><td className="p-4">{expense.createdBy.name}</td><td className="p-4 text-right font-bold">{formatMoney(expense.amount.toNumber())}</td></tr>)}</tbody></table>{expenses.length === 0 && <p className="p-10 text-center text-stone-500">No expenses recorded.</p>}</div>
    </div>
  );
}
