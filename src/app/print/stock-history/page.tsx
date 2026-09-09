import { MovementType } from "@prisma/client";
import { requireRole } from "@/lib/auth/current-user";
import { endOfDay, parseDateInput, startOfDay } from "@/lib/dates";
import { ReportPrintToolbar } from "@/components/print/ReportPrintToolbar";
import { StockHistoryDocument } from "@/components/print/StockHistoryDocument";
import { getBusinessSettings } from "@/lib/settings";
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

export default async function PrintStockHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string; print?: string }>;
}) {
  await requireRole("MANAGER");
  const params = await searchParams;
  const from = params.from ? parseDateInput(params.from) : startOfDay();
  const to = params.to ? endOfDay(params.to) : endOfDay();
  const type =
    params.type && Object.values(MovementType).includes(params.type as MovementType)
      ? (params.type as MovementType)
      : undefined;
  const actionFilter = TYPE_OPTIONS.find((option) => option.value === (type ?? ""))?.label ?? "All actions";

  const [settings, movements] = await Promise.all([
    getBusinessSettings(),
    listMovements(500, { from, to, type }),
  ]);

  const rows = movements.map((move) => ({
    id: move.id,
    createdAt: move.createdAt,
    productName: move.product.name,
    type: move.type,
    locationName: move.location?.name ?? null,
    quantity: move.quantity,
    unitCode: move.product.baseUnit?.code ?? null,
    staffName: move.user.name,
    reason: move.reason,
  }));

  return (
    <div className="print-page print-report">
      <ReportPrintToolbar autoPrint={params.print === "1"} printLabel="Export PDF" />
      <StockHistoryDocument
        businessName={settings.businessName}
        from={from}
        to={to}
        actionFilter={actionFilter}
        rows={rows}
      />
    </div>
  );
}
