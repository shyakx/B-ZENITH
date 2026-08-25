import "dotenv/config";
import { prisma } from "../src/lib/prisma";

export async function snapshotHospitality() {
  const [
    Product,
    Category,
    User,
    InventoryLocation,
    ServiceSession,
    OrderRound,
    SessionItem,
    OrderAdjustment,
    Payment,
    Sale,
    CreditBill,
    InventoryMovement,
    ProductLocationStock,
    locationStock,
    productStock,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.user.count(),
    prisma.inventoryLocation.count(),
    prisma.serviceSession.count(),
    prisma.orderRound.count(),
    prisma.sessionItem.count(),
    prisma.orderAdjustment.count(),
    prisma.payment.count(),
    prisma.sale.count(),
    prisma.creditBill.count(),
    prisma.inventoryMovement.count(),
    prisma.productLocationStock.count(),
    prisma.productLocationStock.aggregate({ _sum: { quantity: true } }),
    prisma.product.aggregate({ _sum: { stockQuantity: true } }),
  ]);
  return {
    Product,
    Category,
    User,
    InventoryLocation,
    ServiceSession,
    OrderRound,
    SessionItem,
    OrderAdjustment,
    Payment,
    Sale,
    CreditBill,
    InventoryMovement,
    ProductLocationStock,
    locationStockSum: locationStock._sum.quantity ?? 0,
    productStockSum: productStock._sum.stockQuantity ?? 0,
  };
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const masked = url.replace(/:([^:@]+)@/, ":***@");
  const localOk = /localhost:5433\/bzenith/.test(url) || /127\.0\.0\.1:5433\/bzenith/.test(url);
  console.log(JSON.stringify({ DATABASE_URL: masked, LOCAL_OK: localOk, snapshot: await snapshotHospitality() }, null, 2));
  await prisma.$disconnect();
  if (!localOk) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
