import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const secret = new TextEncoder().encode(process.env.SESSION_SECRET);

async function token(user) {
  return new SignJWT({ userId: user.id, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

async function fetchPage(path, cookie) {
  const response = await fetch(`http://localhost:3000${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie: `bzenith_session=${cookie}` } : {},
  });
  const body = await response.text();
  return { status: response.status, location: response.headers.get("location"), body };
}

function has(body, text) {
  return body.includes(text);
}

const users = await prisma.user.findMany();
const byName = Object.fromEntries(users.map((user) => [user.name, user]));

const john = await token(byName.John);
const grace = await token(byName.Grace);
const patrick = await token(byName.Patrick);
const admin = await token(byName.Admin);

const checks = [];

const waiterHome = await fetchPage("/waiter", john);
checks.push(["waiter home", waiterHome.status === 200 && has(waiterHome.body, "New order")]);

const newOrder = await fetchPage("/waiter/orders/new", john);
checks.push(["new order", newOrder.status === 200 && has(newOrder.body, "Select table")]);

const cashierHome = await fetchPage("/cashier", grace);
checks.push(["cashier home", cashierHome.status === 200 && has(cashierHome.body, "Open bills")]);

const blocked = await fetchPage("/cashier", john);
checks.push(["waiter blocked from cashier", blocked.status === 307 && (blocked.location || "").includes("/waiter")]);

const manager = await fetchPage("/manager", patrick);
checks.push(["manager dashboard", manager.status === 200 && has(manager.body, "Today")]);

const adminUsers = await fetchPage("/admin/users", admin);
checks.push(["admin users", adminUsers.status === 200 && has(adminUsers.body, "Create user")]);

const adminBlocked = await fetchPage("/admin/users", patrick);
checks.push(["manager blocked from admin", adminBlocked.status === 307 && (adminBlocked.location || "").includes("/manager")]);

for (const [name, ok] of checks) {
  console.log(`${ok ? "OK" : "FAIL"}  ${name}`);
}

await prisma.$disconnect();
if (checks.some(([, ok]) => !ok)) process.exit(1);
