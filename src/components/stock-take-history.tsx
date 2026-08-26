import { formatDateTime } from "@/lib/datetime";
import { locationLabel } from "@/lib/inventory-totals";
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
    return <p className="p-10 text-center text-black">No stock counts recorded yet.</p>;
  }

  return (
    <table className="w-full min-w-[900px] text-left text-sm">
      <thead className="bg-white">
        <tr>
          <th className="p-4">Date</th>
          <th className="p-4">User</th>
          <th className="p-4">Product</th>
          <th className="p-4">Where</th>
          <th className="p-4">System said</th>
          <th className="p-4">You counted</th>
          <th className="p-4">Change</th>
          <th className="p-4">Reason</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-black">
        {logs.map((log) => {
          const details = parseStockTakeDetails(log.details);
          return (
            <tr key={log.id}>
              <td className="p-4">{formatDateTime(log.createdAt)}</td>
              <td className="p-4">{log.user?.name ??"System"}</td>
              <td className="p-4 font-bold">{details?.productName ??"—"}</td>
              <td className="p-4">{details?.locationCode ? locationLabel(details.locationCode) :"—"}</td>
              <td className="p-4">{details?.previousQuantity ??"—"}</td>
              <td className="p-4">{details?.countedQuantity ??"—"}</td>
              <td className={`p-4 font-semibold ${(details?.adjustment ?? 0) < 0 ?"text-black" :"text-black"}`}>
                {details ? `${details.adjustment > 0 ?"+" :""}${details.adjustment}` :"—"}
              </td>
              <td className="p-4">{details?.reason ??"—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
