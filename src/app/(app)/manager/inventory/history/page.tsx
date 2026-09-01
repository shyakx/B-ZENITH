import { requireRole } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { costTimesQuantity, formatRwf } from "@/lib/domain/money";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listReceipts } from "@/services/inventory";

export default async function PurchaseHistoryPage() {
  await requireRole("MANAGER");
  const receipts = await listReceipts();

  return (
    <div>
      <PageHeader title="Purchase History" subtitle="Receipts are always into Main Stock." />
      <Card>
        <div className="space-y-3 text-sm">
          {receipts.map((receipt) => (
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
        </div>
      </Card>
    </div>
  );
}
