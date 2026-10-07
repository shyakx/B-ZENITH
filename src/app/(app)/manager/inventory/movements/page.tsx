import Link from "next/link";
import { MovementType } from "@prisma/client";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime, toDateInput } from "@/lib/dates";
import { formatStockQty } from "@/lib/domain/units";
import { withAutoPrint } from "@/components/print/PrintFactureLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { VisibleDateRange } from "@/components/ui/VisibleDate";
import { listLocations, listMovements } from "@/services/inventory";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, type SearchParams } from "@/lib/list-filters";
import { listCategories, listProductOptions } from "@/services/products";
import { listUsers } from "@/services/users";

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
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("MANAGER");
  const params = await searchParams;
  const { from, to, fromValue, toValue } = dateRange(params);
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
  const [movements, products, categories, locations, staff] = await Promise.all([
    listMovements(200, { from, to, type, productId, categoryId, locationId, userId, search }),
    listProductOptions(),
    listCategories(),
    listLocations(),
    listUsers(),
  ]);
  const fields: ListFilterField[] = [
    { name: "from", label: "From", type: "date", value: fromValue },
    { name: "to", label: "To", type: "date", value: toValue },
    { name: "q", label: "Search", type: "search", value: search, placeholder: "Product, reason, reference, staff" },
    {
      name: "type",
      label: "Action",
      type: "select",
      value: type ?? "",
      options: TYPE_OPTIONS,
    },
    {
      name: "productId",
      label: "Product",
      type: "select",
      value: productId,
      options: [{ value: "", label: "All products" }, ...products.map((product) => ({ value: product.id, label: product.name }))],
    },
    {
      name: "categoryId",
      label: "Category",
      type: "select",
      value: categoryId,
      options: [{ value: "", label: "All categories" }, ...categories.map((category) => ({ value: category.id, label: category.name }))],
    },
    {
      name: "locationId",
      label: "Location",
      type: "select",
      value: locationId,
      options: [{ value: "", label: "All locations" }, ...locations.map((location) => ({ value: location.id, label: location.name }))],
    },
    {
      name: "userId",
      label: "Staff",
      type: "select",
      value: userId,
      options: [{ value: "", label: "All staff" }, ...staff.map((person) => ({ value: person.id, label: person.name }))],
    },
  ];

  const exportQuery = new URLSearchParams({
    from: toDateInput(from),
    to: toDateInput(to),
  });
  if (type) exportQuery.set("type", type);
  for (const key of ["q", "productId", "categoryId", "locationId", "userId"] as const) {
    const value = singleParam(params, key);
    if (value) exportQuery.set(key, value);
  }
  const exportHref = withAutoPrint(`/print/stock-history?${exportQuery.toString()}`);

  return (
    <div>
      <PageHeader title="Stock History" subtitle="Every stock change, newest first." />
      <div className="mb-4">
        <VisibleDateRange from={from} to={to} />
      </div>
      <div className="mb-4">
        <ListFilterForm fields={fields} action="/manager/inventory/movements" />
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          <Link href={exportHref} target="_blank" rel="noreferrer" className="inline-flex">
            <Button type="button" variant="secondary">
              Export PDF
            </Button>
          </Link>
          <Link href="/manager/inventory/history" className="self-center text-sm font-semibold text-zenith-gold">
            Purchase receipts →
          </Link>
        </div>
      </div>

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
