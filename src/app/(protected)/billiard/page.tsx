import { BilliardSalesForm } from "@/components/billiard-sales-form";
import { requireUser } from "@/lib/authorization";
import { sumBilliardAmounts } from "@/lib/billiard";
import { formatDateTime, formatMoney, kigaliDateString } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { billiardRoles } from "@/lib/roles";

export default async function BilliardPage() {
  const user = await requireUser(billiardRoles);
  const today = kigaliDateString();
  const entries = await prisma.billiardDaySale.findMany({
    where: { businessDay: today },
    orderBy: { updatedAt: "desc" },
    include: { operator: { select: { name: true } } },
  });
  const mine = entries.find((entry) => entry.operatorId === user.id);
  const total = sumBilliardAmounts(entries);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Billiard</p>
        <h1 className="text-3xl font-black">Today’s billiard sales</h1>
        <p className="mt-2 text-sm text-stone-500">
          Enter the day’s total take in RWF. Do not add each game. Each operator can save their own total; the day is the sum of those amounts.
        </p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-lg border bg-white p-5">
          <p className="text-sm text-stone-500">Business day</p>
          <p className="mt-1 text-2xl font-black">{today}</p>
        </article>
        <article className="rounded-lg border bg-white p-5">
          <p className="text-sm text-stone-500">All operators today</p>
          <p className="mt-1 text-2xl font-black">{formatMoney(total)}</p>
        </article>
      </section>
      <BilliardSalesForm defaultAmount={mine?.amount.toNumber()} defaultNote={mine?.note ?? undefined} />
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-stone-100">
            <tr>
              <th className="p-4">Operator</th>
              <th className="p-4">Updated</th>
              <th className="p-4">Note</th>
              <th className="p-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="p-4 font-bold">{entry.operator.name}</td>
                <td className="p-4">{formatDateTime(entry.updatedAt)}</td>
                <td className="p-4 text-stone-500">{entry.note || "—"}</td>
                <td className="p-4 text-right font-bold">{formatMoney(entry.amount.toNumber())}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="p-10 text-center text-stone-500">No billiard totals recorded today.</p>}
      </div>
    </div>
  );
}
