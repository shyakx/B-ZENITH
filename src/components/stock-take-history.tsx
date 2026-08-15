import { formatDateTime } from "@/lib/datetime";
import { parseStockTakeDetails } from "@/lib/stock-take";
import type { Prisma } from "@prisma/client";

type Log = {
  id: string;
  createdAt: Date;
  details: Prisma.JsonValue | null;
  user: { name: string } | null;
};

export function StockTakeHistoryTable({ logs }: { logs: Log[] }) {
  if (logs.length === 0) {
    return <p className="p-10 text-center text-stone-500">No stock takes recorded yet.</p>;
  }

  return (
    <table className="w-full min-w-[900px] text-left text-sm">
      <thead className="bg-stone-100">
        <tr>
          <th className="p-4">Date</th>
          <th className="p-4">User</th>
          <th className="p-4">Product</th>
          <th className="p-4">Previous stock</th>
          <th className="p-4">Counted stock</th>
          <th className="p-4">Adjustment</th>
          <th className="p-4">Reason</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {logs.map((log) => {
          const details = parseStockTakeDetails(log.details);
          return (
            <tr key={log.id}>
              <td className="p-4">{formatDateTime(log.createdAt)}</td>
              <td className="p-4">{log.user?.name ?? "System"}</td>
              <td className="p-4 font-bold">{details?.productName ?? "—"}</td>
              <td className="p-4">{details?.previousQuantity ?? "—"}</td>
              <td className="p-4">{details?.countedQuantity ?? "—"}</td>
              <td className={`p-4 font-bold ${(details?.adjustment ?? 0) < 0 ? "text-red-700" : "text-green-700"}`}>
                {details ? `${details.adjustment > 0 ? "+" : ""}${details.adjustment}` : "—"}
              </td>
              <td className="p-4">{details?.reason ?? "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
