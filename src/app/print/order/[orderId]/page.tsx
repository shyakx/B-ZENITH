import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { canViewOrderFacture, ROLE_HOME } from "@/lib/auth/roles";
import { getBusinessSettings } from "@/lib/settings";
import { FactureDocument } from "@/components/print/FactureDocument";
import { PrintButton } from "@/components/print/PrintButton";
import { getOrderById } from "@/services/orders";

export default async function PrintOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const user = await requireRole("CASHIER", "MANAGER", "WAITER");
  const { orderId } = await params;
  const { print } = await searchParams;
  const [order, settings] = await Promise.all([getOrderById(orderId), getBusinessSettings()]);
  if (!order) notFound();
  if (!canViewOrderFacture(user.role, user.id, order.waiterId)) {
    redirect(ROLE_HOME[user.role]);
  }

  return (
    <div className="print-page">
      <div className="mb-4 flex justify-end no-print">
        <PrintButton autoPrint={print === "1"} />
      </div>
      <FactureDocument settings={settings} orders={[order]} />
    </div>
  );
}
