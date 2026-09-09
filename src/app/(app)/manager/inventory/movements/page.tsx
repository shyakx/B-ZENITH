import Link from "next/link";
import { MovementType } from "@prisma/client";
import { requireRole } from "@/lib/auth/current-user";
import { endOfDay, formatDateTime, parseDateInput, startOfDay, toDateInput } from "@/lib/dates";
import { formatStockQty } from "@/lib/domain/units";
import { withAutoPrint } from "@/components/print/PrintFactureLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { VisibleDateRange } from "@/components/ui/VisibleDate";
import { listMovements } from "@/services/inventory";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All actions" },
  { value: "PURCHASE", label: "Receive" },
  { value: "TRANSFER_IN", label: "Transfer in" },
  { value: "TRANSFER_OUT", label: "Transfer out" },
  { value: "COUNT", label: "Count" },
  { value: "ADJUSTMENT", label: "Adjust" },
  { value: "WASTE", label: "Waste" },
  { value: "SALE", label: "Sale" },
  { value: "VOID_RESTORE", label: "Sale voided" },
];

function actionLabel(type: MovementType) {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string }>;
}) {
  await requireRole("MANAGER");
  const params = await searchParams;
  const from = params.from ? parseDateInput(params.from) : startOfDay();
  const to = params.to ? endOfDay(params.to) : endOfDay();
  const type =
    params.type && Object.values(MovementType).includes(params.type as MovementType)
      ? (params.type as MovementType)
      : undefined;

  const movements = await listMovements(200, { from, to, type });

  const exportQuery = new URLSearchParams({
    from: toDateInput(from),
    to: toDateInput(to),
  });
  if (type) exportQuery.set("type", type);
  const exportHref = withAutoPrint(`/print/stock-history?${exportQuery.toString()}`);

  return (
    <div>
      <PageHeader title="Stock History" subtitle="Every stock change, newest first." />
      <div className="mb-4">
        <VisibleDateRange from={from} to={to} />
      </div>
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">From</span>
          <input
            type="date"
            name="from"
            defaultValue={toDateInput(from)}
            className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">To</span>
          <input
            type="date"
            name="to"
            defaultValue={toDateInput(to)}
            className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Action</span>
          <select
            name="type"
            defaultValue={type ?? ""}
            className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-xl bg-zenith-gold px-4 py-2 font-semibold text-white">Apply</button>
        <Link href={exportHref} target="_blank" rel="noreferrer" className="inline-flex">
          <Button type="button" variant="secondary">
            Export PDF
          </Button>
        </Link>
        <Link href="/manager/inventory/history" className="self-center text-sm font-semibold text-zenith-gold">
          Purchase receipts →
        </Link>
      </form>

      <Card>
        {movements.length === 0 ? (
          <p className="text-sm text-zenith-muted">No stock changes in this range.</p>
        ) : (
          <div className="overflow-x-auto text-sm">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-zenith-border text-xs uppercase tracking-wider text-zenith-muted">
                  <th className="border-r border-zenith-border px-3 py-2">Date</th>
                  <th className="border-r border-zenith-border px-3 py-2">Product</th>
                  <th className="border-r border-zenith-border px-3 py-2">Action</th>
                  <th className="border-r border-zenith-border px-3 py-2">Location</th>
                  <th className="border-r border-zenith-border px-3 py-2 text-right">Quantity</th>
                  <th className="border-r border-zenith-border px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Staff</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((move) => {
                  const unit = move.product.baseUnit?.code ?? null;
                  return (
                    <tr key={move.id} className="border-b border-zenith-border align-top">
                      <td className="whitespace-nowrap border-r border-zenith-border px-3 py-2.5">
                        {formatDateTime(move.createdAt)}
                      </td>
                      <td className="border-r border-zenith-border px-3 py-2.5 font-semibold">
                        {move.product.name}
                      </td>
                      <td className="border-r border-zenith-border px-3 py-2.5">{actionLabel(move.type)}</td>
                      <td className="border-r border-zenith-border px-3 py-2.5">
                        {move.location?.name ?? "—"}
                      </td>
                      <td className="border-r border-zenith-border px-3 py-2.5 text-right font-semibold">
                        {move.quantity > 0 ? "+" : ""}
                        {formatStockQty(move.quantity, unit)}
                      </td>
                      <td className="border-r border-zenith-border px-3 py-2.5">{unit ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <div>{move.user.name}</div>
                        {move.reason ? (
                          <div className="mt-0.5 text-xs text-zenith-muted">{move.reason}</div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
