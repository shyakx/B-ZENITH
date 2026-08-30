import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { getBusinessSettings } from "@/lib/settings";
import { FactureDocument } from "@/components/print/FactureDocument";
import { PrintButton } from "@/components/print/PrintButton";
import { getCurrentTableBill } from "@/services/orders";

export default async function PrintTablePage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  await requireRole("CASHIER", "MANAGER");
  const { tableId } = await params;
  const [bill, settings] = await Promise.all([getCurrentTableBill(tableId), getBusinessSettings()]);
  if (!bill) notFound();

  if (bill.orders.length === 0) {
    return (
      <div className="min-h-screen bg-zenith-bg p-6">
        <p className="mx-auto max-w-2xl rounded-2xl border border-zenith-border bg-white px-4 py-8 text-center font-semibold">
          No open bill for this table.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zenith-bg p-6">
      <div className="mb-4 flex justify-end no-print">
        <PrintButton />
      </div>
      <FactureDocument settings={settings} orders={bill.orders} />
    </div>
  );
}
