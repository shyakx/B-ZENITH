import Link from "next/link";
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
      <div>
        <Link href="/sales" className="text-sm font-bold text-[#947313]">
          ← Today’s sales
        </Link>
        <h1 className="mt-2 text-3xl font-black">Closed days</h1>
        <p className="mt-1 text-sm text-stone-500">
          Each close stores that day’s totals. Open a day to see the original receipts again.
        </p>
      </div>
      {closes.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border bg-white p-5">
            <p className="text-sm text-stone-500">Closed days</p>
            <p className="mt-2 text-2xl font-black">{closes.length}</p>
          </article>
          <article className="rounded-lg border bg-white p-5">
            <p className="text-sm text-stone-500">Archived net sales</p>
            <p className="mt-2 text-2xl font-black">
              {formatMoney(
                closes.reduce((sum, row) => sum + row.posNet.toNumber(), 0),
                currency,
              )}
            </p>
          </article>
        </section>
      ) : null}
      {closes.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">No days have been closed yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
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
