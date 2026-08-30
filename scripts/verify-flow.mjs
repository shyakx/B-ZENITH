import { PrismaClient, PaymentMethod } from "@prisma/client";
import { createOrder } from "../src/services/orders";
import { markPayLater, recordPayment } from "../src/services/payments";
import { receivePurchase, recordWaste } from "../src/services/inventory";

const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const john = await prisma.user.findFirst({ where: { name: "John" } });
const mary = await prisma.user.findFirst({ where: { name: "Mary" } });
const grace = await prisma.user.findFirst({ where: { name: "Grace" } });
const patrick = await prisma.user.findFirst({ where: { name: "Patrick" } });
const table = await prisma.serviceTable.findFirst({ where: { name: "7" } });
const beer = await prisma.product.findFirst({ where: { name: "Heineken" } });
const chicken = await prisma.product.findFirst({ where: { name: "Whole Chicken" } });
const soda = await prisma.product.findFirst({ where: { name: "Fanta" } });

assert(john && mary && grace && patrick && table && beer && chicken && soda, "Seed data missing");

const beerBefore = beer.stockQuantity;
const sodaBefore = soda.stockQuantity;

const johnOrder = await createOrder({
  waiterId: john.id,
  tableId: table.id,
  idempotencyKey: `verify-john-${Date.now()}`,
  items: [
    { productId: beer.id, quantity: 2 },
    { productId: chicken.id, quantity: 1 },
  ],
});

const replay = await createOrder({
  waiterId: john.id,
  tableId: table.id,
  idempotencyKey: johnOrder.idempotencyKey,
  items: [{ productId: beer.id, quantity: 2 }],
});

assert(replay.id === johnOrder.id, "Idempotent order create failed");
assert(johnOrder.orderNumber >= 1001, "Order number did not start from the sequence");
assert(johnOrder.waiterId === john.id, "Waiter ownership lost");
assert(johnOrder.tableId === table.id, "Table not stored");
assert(johnOrder.total === 24000, `Unexpected John total ${johnOrder.total}`);
assert(johnOrder.paymentStatus === "UNPAID", "New order should be unpaid");

const maryOrder = await createOrder({
  waiterId: mary.id,
  tableId: table.id,
  idempotencyKey: `verify-mary-${Date.now()}`,
  items: [{ productId: soda.id, quantity: 1 }],
});

assert(maryOrder.orderNumber !== johnOrder.orderNumber, "Order numbers must be unique");
assert(maryOrder.waiterId === mary.id, "Mary should remain on her own order");
assert(maryOrder.tableId === table.id, "Both waiters can serve table 7");

const beerAfter = await prisma.product.findUnique({ where: { id: beer.id } });
const sodaAfter = await prisma.product.findUnique({ where: { id: soda.id } });
assert(beerAfter.stockQuantity === beerBefore - 2, "Tracked drink stock was not deducted");
assert(sodaAfter.stockQuantity === sodaBefore - 1, "Soda stock was not deducted");

const firstPay = await recordPayment({
  orderId: johnOrder.id,
  amount: 10000,
  method: PaymentMethod.CASH,
  cashierId: grace.id,
  idempotencyKey: `pay-${johnOrder.id}-1`,
});
assert(firstPay.paymentStatus === "PARTIALLY_PAID", "Partial payment status wrong");
assert(firstPay.paidAmount === 10000, "Paid amount not stored");

const replayPay = await recordPayment({
  orderId: johnOrder.id,
  amount: 10000,
  method: PaymentMethod.CASH,
  cashierId: grace.id,
  idempotencyKey: `pay-${johnOrder.id}-1`,
});
assert(replayPay.paidAmount === 10000, "Duplicate payment was accepted");

const rest = await recordPayment({
  orderId: johnOrder.id,
  amount: 14000,
  method: PaymentMethod.CASH,
  cashierId: grace.id,
  idempotencyKey: `pay-${johnOrder.id}-2`,
});
assert(rest.paymentStatus === "PAID", "Full payment did not mark PAID");
assert(rest.status === "COMPLETED", "Paid order should complete");

const later = await markPayLater({
  orderId: maryOrder.id,
  customerName: "Development customer",
  customerPhone: "0780000000",
  cashierId: grace.id,
});
assert(later.paymentStatus === "PAY_LATER", "Pay later not recorded");

await receivePurchase({
  productId: beer.id,
  quantity: 6,
  userId: patrick.id,
  notes: "Verification purchase",
});
const beerBought = await prisma.product.findUnique({ where: { id: beer.id } });
assert(beerBought.stockQuantity === beerAfter.stockQuantity + 6, "Purchase did not increase stock");

await recordWaste({
  productId: beer.id,
  quantity: 1,
  reason: "Broken bottle",
  userId: patrick.id,
});
const beerWaste = await prisma.product.findUnique({ where: { id: beer.id } });
assert(beerWaste.stockQuantity === beerBought.stockQuantity - 1, "Waste did not decrease stock");

let blocked = false;
try {
  await recordWaste({
    productId: beer.id,
    quantity: beerWaste.stockQuantity + 10,
    reason: "Too much",
    userId: patrick.id,
  });
} catch {
  blocked = true;
}
assert(blocked, "Negative stock was allowed");

console.log("OK  create order, unique numbers, two waiters on one table");
console.log("OK  stock deduction, purchase, waste, negative stock blocked");
console.log("OK  partial payment, duplicate payment blocked, pay later");
console.log(`Orders created: #${johnOrder.orderNumber} (John) and #${maryOrder.orderNumber} (Mary) on table 7`);

await prisma.$disconnect();
