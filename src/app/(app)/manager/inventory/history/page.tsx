import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { costTimesQuantity, formatRwf } from "@/lib/domain/money";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listLocations, listReceipts } from "@/services/inventory";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, validAmountParam, type SearchParams } from "@/lib/list-filters";
import { listProductOptions } from "@/services/products";
import { listSuppliers } from "@/services/suppliers";
import { listUsers } from "@/services/users";

export default async function PurchaseHistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("MANAGER");
  const params = await searchParams;
  const { from, to, fromValue, toValue } = dateRange(params);
  const supplierId = singleParam(params, "supplierId");
  const receivedById = singleParam(params, "receivedById");
  const productId = singleParam(params, "productId");
  const locationId = singleParam(params, "locationId");
  const search = singleParam(params, "q");
  const minCost = validAmountParam(singleParam(params, "minCost"));
  const maxCost = validAmountParam(singleParam(params, "maxCost"));
  const [receipts, suppliers, staff, products, locations] = await Promise.all([
    listReceipts(200, { from, to, supplierId, receivedById, productId, locationId, search }),
    listSuppliers(),
    listUsers(),
    listProductOptions(),
    listLocations(),
  ]);
  const fields: ListFilterField[] = [
    { name: "from", label: "Received from", type: "date", value: fromValue },
    { name: "to", label: "Received to", type: "date", value: toValue },
    { name: "q", label: "Search", type: "search", value: search, placeholder: "Supplier, product, reference, staff" },
    { name: "minCost", label: "Min receipt cost", type: "number", value: singleParam(params, "minCost") },
    { name: "maxCost", label: "Max receipt cost", type: "number", value: singleParam(params, "maxCost") },
    {
      name: "supplierId",
      label: "Supplier",
      type: "select",
      value: supplierId,
      options: [{ value: "", label: "All suppliers" }, ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))],
    },
    {
      name: "receivedById",
      label: "Received by",
      type: "select",
      value: receivedById,
      options: [{ value: "", label: "All staff" }, ...staff.map((person) => ({ value: person.id, label: person.name }))],
    },
    {
      name: "productId",
      label: "Product",
      type: "select",
      value: productId,
      options: [{ value: "", label: "All products" }, ...products.map((product) => ({ value: product.id, label: product.name }))],
    },
    {
      name: "locationId",
      label: "Location",
      type: "select",
      value: locationId,
      options: [{ value: "", label: "All locations" }, ...locations.map((location) => ({ value: location.id, label: location.name }))],
    },
  ];
  const matchingReceipts = receipts.filter((receipt) => {
    const totalCost = receipt.lines.reduce(
      (total, line) => total + Number(costTimesQuantity(line.unitCost, line.baseQuantity).toString()),
      0,
    );
    return (minCost == null || totalCost >= minCost) && (maxCost == null || totalCost <= maxCost);
  });

  return (
    <div>
      <PageHeader
        title="Purchase receipts"
        subtitle="Supplier deliveries into Main stock. Newest first."
      />
      <p className="mb-4 text-sm">
        <Link href="/manager/inventory/movements" className="font-semibold text-zenith-gold">
          All stock changes →
        </Link>
      </p>
      <ListFilterForm fields={fields} action="/manager/inventory/history" />
      <p className="mb-2 text-xs text-zenith-muted">{matchingReceipts.length} receipts shown (maximum 200).</p>
      <Card>
        <div className="space-y-3 text-sm">
          {matchingReceipts.map((receipt) => (
            <div key={receipt.id} className="flex flex-wrap justify-between gap-2 border-b border-zenith-border pb-2">
              <div>
                <div className="font-semibold">{receipt.supplier.name}</div>
                <div className="text-zenith-muted">
                  {receipt.location.name} · {receipt.receivedBy.name} · {formatDateTime(receipt.receivedAt)}
                  {receipt.reference ? ` · ${receipt.reference}` : ""}
                </div>
                {receipt.lines.map((line) => (
                  <div key={line.id}>
                    {line.product.name} · {line.packQuantity}
                    {line.unitCost != null
                      ? ` · ${formatRwf(costTimesQuantity(line.unitCost, line.baseQuantity))} paid`
                      : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {matchingReceipts.length === 0 ? (
            <p className="text-sm text-zenith-muted">No receipts match these filters.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
