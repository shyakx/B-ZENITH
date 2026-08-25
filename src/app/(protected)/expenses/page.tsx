import { createExpense } from "@/actions/expenses";
import { LiveRefresh } from "@/components/live-refresh";
import { StatCards } from "@/components/stat-cards";
import { requireUser } from "@/lib/authorization";
import { businessRoles } from "@/lib/roles";
import { formatDate, formatMoney, kigaliDateString, todayKigaliRange } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export default async function ExpensesPage() {
  await requireUser(businessRoles);
  const { start, end } = todayKigaliRange();
  const [expenses, todayTotal, settings] = await Promise.all([
    prisma.expense.findMany({
      take: 250,
      orderBy: { incurredAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.expense.aggregate({
      where: { incurredAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);
  const currency = settings?.currency ?? "RWF";
  const listedTotal = expenses.reduce((sum, expense) => sum + expense.amount.toNumber(), 0);
  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Operations</p>
        <h1 className="text-3xl font-black">Expenses</h1>
      </div>
      <StatCards
        currency={currency}
        cards={[
          { label: "Today", value: todayTotal._sum.amount?.toNumber() ?? 0, money: true },
          { label: "Today’s entries", value: String(todayTotal._count) },
          { label: "Listed total", value: listedTotal, money: true },
        ]}
      />
      <form action={createExpense} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[1fr_2fr_1fr_1fr_auto]">
        <select name="category" className="min-h-11 rounded-md border px-3">{["Rent", "Utilities", "Transport", "Supplies", "Maintenance", "Other"].map((category) => <option key={category}>{category}</option>)}</select>
        <input required name="description" minLength={3} placeholder="Description" className="min-h-11 rounded-md border px-3" />
        <input required name="amount" type="number" min="1" step="0.01" placeholder="Amount RWF" className="min-h-11 rounded-md border px-3" />
        <input required name="date" type="date" defaultValue={kigaliDateString()} className="min-h-11 rounded-md border px-3" />
        <button className="min-h-11 rounded-md bg-black px-5 font-bold text-[#d4af37]">Record</button>
      </form>
      <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-stone-100"><tr><th className="p-4">Date</th><th className="p-4">Category</th><th className="p-4">Description</th><th className="p-4">Created by</th><th className="p-4 text-right">Amount</th></tr></thead><tbody className="divide-y">{expenses.map((expense) => <tr key={expense.id}><td className="p-4">{formatDate(expense.incurredAt)}</td><td className="p-4 font-bold">{expense.category}</td><td className="p-4">{expense.description}</td><td className="p-4">{expense.createdBy.name}</td><td className="p-4 text-right font-bold">{formatMoney(expense.amount.toNumber())}</td></tr>)}</tbody></table>{expenses.length === 0 && <p className="p-10 text-center text-stone-500">No expenses recorded.</p>}</div>
    </div>
  );
}
