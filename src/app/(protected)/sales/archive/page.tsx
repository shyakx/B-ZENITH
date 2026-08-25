import Link from "next/link";
import { DashboardHeader, StatCard, StatGrid } from "@/components/dashboard/ui";
import { requireUser } from "@/lib/authorization";
import { dayCloseRoles } from "@/lib/business-day";
import { formatDateTime, formatMoney } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SalesArchivePage() {
  await requireUser(dayCloseRoles);
  const [closes, settings] = await Promise.all([
    prisma.businessDayClose.findMany({
      orderBy: { businessDay: "desc" },
      take: 120,
      include: { closedBy: { select: { name: true } } },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);
  const currency = settings?.currency ?? "RWF";

  return (
    <div className="space-y-6">
      <DashboardHeader
        kicker="Finance"
        title="Closed days"
        subtitle="Each close stores that day’s totals. Open a day to see the original receipts again."
        actions={
          <Link href="/sales" className="grid min-h-11 place-items-center rounded-md border border-stone-400 px-4 font-bold">
            Today’s sales
          </Link>
        }
      />
      {closes.length > 0 ? (
        <StatGrid columns={3}>
          <StatCard label="Closed days" value={String(closes.length)} />
          <StatCard
            label="Archived net sales"
            value={formatMoney(
              closes.reduce((sum, row) => sum + row.posNet.toNumber(), 0),
              currency,
            )}
          />
        </StatGrid>
      ) : null}
      {closes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">No days have been closed yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Day</th>
                <th className="p-4">Closed</th>
                <th className="p-4">By</th>
                <th className="p-4 text-right">Net sales</th>
                <th className="p-4 text-right">Billiard</th>
                <th className="p-4 text-right">Expenses</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {closes.map((row) => (
                <tr key={row.id}>
                  <td className="p-4 font-bold">{row.businessDay}</td>
                  <td className="p-4">{formatDateTime(row.closedAt)}</td>
                  <td className="p-4">{row.closedBy.name}</td>
                  <td className="p-4 text-right font-bold">{formatMoney(row.posNet.toNumber(), currency)}</td>
                  <td className="p-4 text-right">{formatMoney(row.billiardTotal.toNumber(), currency)}</td>
                  <td className="p-4 text-right">{formatMoney(row.expenseTotal.toNumber(), currency)}</td>
                  <td className="p-4">
                    <Link href={`/sales?from=${row.businessDay}&to=${row.businessDay}`} className="font-bold text-[#947313]">
                      Open day
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
