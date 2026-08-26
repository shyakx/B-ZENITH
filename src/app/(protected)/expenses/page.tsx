import { createExpense } from "@/actions/expenses";
import { DashboardHeader } from "@/components/dashboard/ui";
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
      orderBy: { incurredAt:"desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.expense.aggregate({
      where: { incurredAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.businessSettings.findUnique({ where: { id:"default" } }),
  ]);
  const currency = settings?.currency ??"RWF";
  const listedTotal = expenses.reduce((sum, expense) => sum + expense.amount.toNumber(), 0);
  return (
    <div className="space-y-6">
      <LiveRefresh />
      <DashboardHeader kicker="Finance" title="Expenses" subtitle="Record operating costs for the current Kigali business day." />
      <StatCards
        currency={currency}
        cards={[
          { label:"Today", value: todayTotal._sum.amount?.toNumber() ?? 0, money: true },
          { label:"Today’s entries", value: String(todayTotal._count) },
          { label:"Listed total", value: listedTotal, money: true },
        ]}
      />
      <form action={createExpense} className="grid gap-3 rounded-lg border border-black bg-white p-4 md:grid-cols-[1fr_2fr_1fr_1fr_auto]">
        <select name="category" className="min-h-11 rounded-md border px-3">{["Rent","Utilities","Transport","Supplies","Maintenance","Other"].map((category) => <option key={category}>{category}</option>)}</select>
        <input required name="description" minLength={3} placeholder="Description" className="min-h-11 rounded-md border px-3" />
        <input required name="amount" type="number" min="1" step="0.01" placeholder="Amount RWF" className="min-h-11 rounded-md border px-3" />
        <input required name="date" type="date" defaultValue={kigaliDateString()} className="min-h-11 rounded-md border px-3" />
        <button className="bz-btn-primary">Record</button>
      </form>
      <div className="space-y-2 md:hidden">
        {expenses.map((expense) => (
          <article key={expense.id} className="rounded-md border border-black bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{expense.category}</p>
                <p className="mt-1 text-sm font-normal">{expense.description}</p>
              </div>
              <p className="text-sm font-semibold">{formatMoney(expense.amount.toNumber())}</p>
            </div>
            <p className="mt-2 text-xs font-normal text-black">{formatDate(expense.incurredAt)} · {expense.createdBy.name}</p>
          </article>
        ))}
        {expenses.length === 0 && <p className="rounded-md border border-black p-8 text-center text-black">No expenses recorded.</p>}
      </div>
      <div className="hidden overflow-x-auto rounded-md border border-black bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-white">
            <tr>
              <th className="p-3 text-xs font-medium">Date</th>
              <th className="p-3 text-xs font-medium">Category</th>
              <th className="p-3 text-xs font-medium">Description</th>
              <th className="p-3 text-xs font-medium">Created by</th>
              <th className="p-3 text-right text-xs font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="p-3">{formatDate(expense.incurredAt)}</td>
                <td className="p-3 font-medium">{expense.category}</td>
                <td className="p-3">{expense.description}</td>
                <td className="p-3">{expense.createdBy.name}</td>
                <td className="p-3 text-right font-semibold">{formatMoney(expense.amount.toNumber())}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && <p className="p-10 text-center text-black">No expenses recorded.</p>}
      </div>
    </div>
  );
}
