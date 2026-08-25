import { HospitalityPos } from "@/components/hospitality/HospitalityPos";
import { requireUser } from "@/lib/authorization";
import { tillRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { SessionInfo, TableInfo } from "@/components/hospitality/types";

export default async function PosPage() {
  const user = await requireUser(tillRoles);

  const [categories, products, settings, sessions, tables] = await Promise.all([
    prisma.category.findMany({
      where: { active: true, products: { some: { active: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { active: true, category: { active: true } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        trackInventory: true,
        sellingLocationId: true,
        locationStocks: { include: { location: { select: { id: true, code: true } } } },
        categoryId: true,
        variants: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, sku: true, sellingPrice: true },
        },
      },
    }),
    prisma.businessSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    }),
    prisma.serviceSession.findMany({
        where: { status: { in: ["ACTIVE", "SETTLING"] } },
        include: {
            waiter: { select: { name: true } },
            table: true,
            rounds: { include: { items: true } }
        },
        orderBy: { openedAt: "desc" }
    }),
    prisma.table.findMany({
        orderBy: { sortOrder: "asc" }
    })
  ]);

  const sellable = products
    .filter((product) => product.variants.length > 0)
    .map((product) => ({
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      trackInventory: product.trackInventory,
      stockQuantity:
        product.locationStocks.find((row) => row.locationId === product.sellingLocationId)?.quantity ??
        product.locationStocks.find((row) => row.location.code === "BAR")?.quantity ??
        product.stockQuantity,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        sellingPrice: variant.sellingPrice.toFixed(2),
      })),
    }));

  const mappedSessions: SessionInfo[] = sessions.map(s => {
      const allItems = s.rounds.flatMap(r => r.items);
      const totalAmount = allItems
          .filter(i => i.status === 'ACTIVE')
          .reduce((sum, i) => sum + (Number(i.unitPrice) * i.qty), 0);

      return {
          id: s.id,
          channel: s.channel,
          status: s.status,
          waiterId: s.waiterId,
          waiter: s.waiter,
          tableId: s.tableId,
          table: s.table as TableInfo | null,
          destinationLabel: s.destinationLabel,
          customerName: s.customerName,
          customerPhone: s.customerPhone,
          deliveryAddress: s.deliveryAddress,
          openedAt: s.openedAt.toISOString(),
          totalAmount,
          roundCount: s.rounds.length
      };
  });

  return (
    <HospitalityPos
      initialSessions={mappedSessions}
      initialTables={tables as TableInfo[]}
      categories={categories}
      products={sellable}
      currency={settings.currency}
      taxRate={settings.taxEnabled ? settings.taxRate.toFixed(2) : "0.00"}
    />
  );
}
