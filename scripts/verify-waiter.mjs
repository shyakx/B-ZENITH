import { PrismaClient } from "@prisma/client";
import { hasPermission } from "../src/lib/auth/roles";
import { createOrder } from "../src/services/orders";

const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const john = await prisma.user.findFirst({ where: { name: "John" } });
const mary = await prisma.user.findFirst({ where: { name: "Mary" } });
const table7 = await prisma.serviceTable.findFirst({ where: { name: "7" } });
const burger = await prisma.product.findFirst({ where: { name: "Chicken Burger" } });
const heineken = await prisma.product.findFirst({ where: { name: "Heineken" } });
const water = await prisma.product.findFirst({ where: { name: "Water" } });

assert(john && mary && table7 && burger && heineken && water, "Waiter seed data missing");

const first = await createOrder({
  waiterId: john.id,
  tableId: table7.id,
  idempotencyKey: `waiter-john-1-${Date.now()}`,
  items: [
    { productId: burger.id, quantity: 2 },
    { productId: heineken.id, quantity: 3 },
  ],
});
assert(first.orderNumber === 1001, `Expected #1001, got #${first.orderNumber}`);
assert(first.waiterId === john.id && first.tableId === table7.id, "John/table attribution failed");
assert(first.total === 22000, `Expected 22,000 RWF, got ${first.total}`);
assert(first.paymentStatus === "UNPAID", "New order must be unpaid");

const replay = await createOrder({
  waiterId: john.id,
  tableId: table7.id,
  idempotencyKey: first.idempotencyKey,
  items: [{ productId: burger.id, quantity: 2 }],
});
assert(replay.id === first.id, "Duplicate submit created a second order");

const second = await createOrder({
  waiterId: mary.id,
  tableId: table7.id,
  idempotencyKey: `waiter-mary-1-${Date.now()}`,
  items: [{ productId: water.id, quantity: 2 }],
});
assert(second.orderNumber === 1002, `Expected #1002, got #${second.orderNumber}`);
assert(second.waiterId === mary.id, "Mary must stay on her own order");
assert(second.id !== first.id, "Orders were merged");

const johnOrders = await prisma.order.findMany({ where: { waiterId: john.id } });
assert(johnOrders.every((order) => order.waiterId === john.id), "John saw another waiter's order");
assert(!johnOrders.some((order) => order.id === second.id), "Mary's order leaked into John's list");

const third = await createOrder({
  waiterId: john.id,
  tableId: table7.id,
  idempotencyKey: `waiter-john-2-${Date.now()}`,
  items: [{ productId: heineken.id, quantity: 2 }],
});
assert(third.orderNumber === 1003, `Expected #1003, got #${third.orderNumber}`);
assert(third.id !== first.id && third.id !== second.id, "Additional order was merged");

const originalPrice = burger.sellingPrice;
await prisma.product.update({ where: { id: burger.id }, data: { sellingPrice: 99999 } });
const frozen = await prisma.orderItem.findFirst({
  where: { orderId: first.id, name: "Chicken Burger" },
});
assert(frozen.unitPrice === originalPrice, "Historical price was overwritten");
await prisma.product.update({ where: { id: burger.id }, data: { sellingPrice: originalPrice } });

assert(hasPermission("WAITER", "createOrder") === true, "Waiter cannot create orders");
assert(hasPermission("WAITER", "recordPayment") === false, "Waiter can record payment");
assert(hasPermission("WAITER", "manageProducts") === false, "Waiter can change prices");
assert(hasPermission("WAITER", "manageUsers") === false, "Waiter can manage users");

console.log("OK  #1001 John Table 7  2x Chicken Burger + 3x Heineken = 22,000");
console.log("OK  #1002 Mary Table 7  2x Water — kept separate");
console.log("OK  #1003 John Table 7  additional order, not merged");
console.log("OK  retry protected, historical price frozen, waiter cannot pay");

await prisma.$disconnect();
