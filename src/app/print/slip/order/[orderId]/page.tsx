import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { canViewOrderSlip, ROLE_HOME } from "@/lib/auth/roles";
import { getBusinessSettings } from "@/lib/settings";
import { PreFactureDocument } from "@/components/print/PreFactureDocument";
import { PrintToolbar } from "@/components/print/PrintButton";
import { getOrderById } from "@/services/orders";

export default async function PrintOrderSlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const user = await requireRole("WAITER");
  const { orderId } = await params;
  const { print } = await searchParams;
  const [order, settings] = await Promise.all([getOrderById(orderId), getBusinessSettings()]);
  if (!order) notFound();
  if (!canViewOrderSlip(user.role, user.id, order.waiterId)) {
    redirect(ROLE_HOME[user.role]);
  }

  return (
    <div className="print-page" data-paper={settings.receiptPaperMm}>
      <PrintToolbar autoPrint={print === "1"} paperMm={settings.receiptPaperMm} printLabel="Print slip" />
      <PreFactureDocument settings={settings} orders={[order]} />
    </div>
  );
}
