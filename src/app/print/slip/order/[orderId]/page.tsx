import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { canViewOrderSlip, ROLE_HOME } from "@/lib/auth/roles";
import {
  commandeStationForProduct,
  splitItemsByCommandeStation,
} from "@/lib/domain/commande-slip";
import { prisma } from "@/lib/prisma";
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

  const productIds = [...new Set(order.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      productType: true,
      category: { select: { area: true } },
      defaultStockLocation: { select: { code: true } },
    },
  });
  const stationByProductId = new Map(
    products.map((product) => [
      product.id,
      commandeStationForProduct({
        categoryArea: product.category.area,
        productType: product.productType,
        defaultStockLocationCode: product.defaultStockLocation?.code,
      }),
    ]),
  );
  const slips = splitItemsByCommandeStation(order.items, stationByProductId);

  return (
    <div className="print-page" data-paper={settings.receiptPaperMm}>
      <PrintToolbar autoPrint={print === "1"} paperMm={settings.receiptPaperMm} printLabel="Print slips" />
      {slips.map((slip) => (
        <PreFactureDocument
          key={slip.station}
          settings={settings}
          orders={[order]}
          station={slip.station}
          items={slip.items}
        />
      ))}
    </div>
  );
}
