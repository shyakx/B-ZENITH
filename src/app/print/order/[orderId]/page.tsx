import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { getBusinessSettings } from "@/lib/settings";
import { FactureDocument } from "@/components/print/FactureDocument";
import { PrintButton } from "@/components/print/PrintButton";
import { getOrderById } from "@/services/orders";

export default async function PrintOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireRole("CASHIER", "MANAGER");
  const { orderId } = await params;
  const [order, settings] = await Promise.all([getOrderById(orderId), getBusinessSettings()]);
  if (!order) notFound();

  return (
    <div className="min-h-screen bg-zenith-bg p-6">
      <div className="mb-4 flex justify-end no-print">
        <PrintButton />
      </div>
      <FactureDocument settings={settings} orders={[order]} />
    </div>
  );
}
