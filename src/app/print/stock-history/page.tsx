import { MovementType } from "@prisma/client";
import { requireRole } from "@/lib/auth/current-user";
import { endOfDay, parseDateInput, startOfDay } from "@/lib/dates";
import { ReportPrintToolbar } from "@/components/print/ReportPrintToolbar";
import { StockHistoryDocument } from "@/components/print/StockHistoryDocument";
import { getBusinessSettings } from "@/lib/settings";
import { listLocations, listMovements } from "@/services/inventory";
import { listCategories, listProductOptions } from "@/services/products";
import { listUsers } from "@/services/users";
import { singleParam, validDateParam, type SearchParams } from "@/lib/list-filters";

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
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("MANAGER");
  const params = await searchParams;
  const fromValue = singleParam(params, "from");
  const toValue = singleParam(params, "to");
  const from = validDateParam(fromValue) ? parseDateInput(fromValue) : startOfDay();
  const to = validDateParam(toValue) ? endOfDay(toValue) : endOfDay();
  const typeValue = singleParam(params, "type");
  const type =
    typeValue && Object.values(MovementType).includes(typeValue as MovementType)
      ? (typeValue as MovementType)
      : undefined;
  const productId = singleParam(params, "productId");
  const categoryId = singleParam(params, "categoryId");
  const locationId = singleParam(params, "locationId");
  const userId = singleParam(params, "userId");
  const search = singleParam(params, "q");
  const actionFilter = TYPE_OPTIONS.find((option) => option.value === (type ?? ""))?.label ?? "All actions";

  const [settings, movements, products, categories, locations, staff] = await Promise.all([
    getBusinessSettings(),
    listMovements(500, { from, to, type, productId, categoryId, locationId, userId, search }),
    listProductOptions(),
    listCategories(),
    listLocations(),
    listUsers(),
  ]);
  const filterLabels = [
    actionFilter !== "All actions" ? actionFilter : "",
    products.find((product) => product.id === productId)?.name ?? "",
    categories.find((category) => category.id === categoryId)?.name ?? "",
    locations.find((location) => location.id === locationId)?.name ?? "",
    staff.find((person) => person.id === userId)?.name ?? "",
    search,
  ].filter(Boolean);

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
      <ReportPrintToolbar autoPrint={singleParam(params, "print") === "1"} printLabel="Export PDF" />
      <StockHistoryDocument
        businessName={settings.businessName}
        from={from}
        to={to}
        actionFilter={filterLabels.join(" · ") || "All actions"}
        rows={rows}
      />
    </div>
  );
}
