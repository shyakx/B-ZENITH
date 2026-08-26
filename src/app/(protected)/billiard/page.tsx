import { BilliardSalesForm } from "@/components/billiard-sales-form";
import { DashboardHeader } from "@/components/dashboard/ui";
import { LiveRefresh } from "@/components/live-refresh";
import { StatCards } from "@/components/stat-cards";
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
    orderBy: { updatedAt:"desc" },
    include: { operator: { select: { name: true } } },
  });
  const mine = entries.find((entry) => entry.operatorId === user.id);
  const total = sumBilliardAmounts(entries);
  const settings = await prisma.businessSettings.findUnique({ where: { id:"default" } });
  const currency = settings?.currency ??"RWF";

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <DashboardHeader
        kicker="Billiard"
        title="Today’s billiard sales"
        subtitle="Enter the day’s total take in RWF. Do not add each game. Each operator can save their own total; the day is the sum of those amounts."
      />
      <StatCards
        currency={currency}
        cards={[
          { label:"Business day", value: today },
          { label:"All operators today", value: total, money: true },
          { label:"Your total", value: mine?.amount.toNumber() ?? 0, money: true },
        ]}
      />
      <BilliardSalesForm defaultAmount={mine?.amount.toNumber()} defaultNote={mine?.note ?? undefined} />
      <div className="overflow-x-auto rounded-lg border border-black bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white">
            <tr>
              <th className="p-4">Operator</th>
              <th className="p-4">Updated</th>
              <th className="p-4">Note</th>
              <th className="p-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="p-4 font-bold">{entry.operator.name}</td>
                <td className="p-4">{formatDateTime(entry.updatedAt)}</td>
                <td className="p-4 text-black">{entry.note ||"—"}</td>
                <td className="p-4 text-right font-bold">{formatMoney(entry.amount.toNumber())}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="p-10 text-center text-black">No billiard totals recorded today.</p>}
      </div>
    </div>
  );
}
