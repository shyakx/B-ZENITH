import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { FulfillmentStatus, PaymentMethod, ServiceChannel } from "@prisma/client";
import { assertLocalDatabase } from "./assert-local-database";
import { prisma } from "../src/lib/prisma";

assertLocalDatabase();

const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const password = process.env.SEED_USER_PASSWORD ?? "BZenith@2026";
const TEMP_PIN = "2491";

type CookieJar = string[];

function cookieHeader(jar: CookieJar) {
  return jar.map((cookie) => cookie.split(";")[0]).join("; ");
}

function store(jar: CookieJar, headers: Headers) {
  const set = headers.getSetCookie?.() ?? [];
  for (const cookie of set) {
    const name = cookie.split("=")[0];
    const rest = jar.filter((item) => !item.startsWith(`${name}=`));
    jar.length = 0;
    jar.push(...rest, cookie);
  }
}

async function request(path: string, jar: CookieJar, init: RequestInit = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      ...(init.headers ?? {}),
      cookie: cookieHeader(jar),
    },
  });
  store(jar, response.headers);
  return response;
}

async function login(email: string, loginPassword = password) {
  const jar: CookieJar = [];
  const csrfRes = await request("/api/auth/csrf", jar);
  const csrf = (await csrfRes.json()) as { csrfToken: string };
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password: loginPassword,
    json: "true",
    callbackUrl: base,
  });
  const auth = await request("/api/auth/callback/credentials", jar, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (auth.status >= 400) throw new Error(`Login failed for ${email}: ${auth.status}`);
  const session = await request("/api/auth/session", jar);
  const data = (await session.json()) as { user?: { id?: string; email?: string; role?: string } };
  if (data.user?.email !== email) throw new Error(`Session was not established for ${email}.`);
  return { jar, role: data.user.role, id: data.user.id };
}

async function jsonRequest(path: string, jar: CookieJar, method: string, body?: unknown) {
  return request(path, jar, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function main() {
  const health = await fetch(base).catch(() => null);
  if (!health) throw new Error(`App is not running at ${base}`);
  const loginPage = await fetch(`${base}/login`);
  if (!loginPage.ok) throw new Error(`Login page should load, got ${loginPage.status}`);
  const posAnon = await fetch(`${base}/pos`, { redirect: "manual" });
  if (![307, 308, 302].includes(posAnon.status)) {
    throw new Error(`Anonymous POS should redirect, got ${posAnon.status}`);
  }

  const results: string[] = [];
  const createdSessionIds: string[] = [];
  const manager = await prisma.user.findFirstOrThrow({ where: { role: "MANAGER", active: true } });
  const pinSnapshot = await prisma.user.findUniqueOrThrow({
    where: { id: manager.id },
    select: { pinHash: true, pinFailedAttempts: true, pinLockedUntil: true },
  });
  const drinkStock = await prisma.productLocationStock.findFirst({
    where: {
      quantity: { gte: 1 },
      location: { code: "BAR" },
      product: { trackInventory: true, active: true },
    },
    include: { product: { select: { id: true, sellingPrice: true, stockQuantity: true, sellingLocationId: true } }, location: true },
  });
  if (!drinkStock) throw new Error("Need a bar product with available stock for HTTP E2E.");
  const drink = drinkStock.product;
  const price = Number(drink.sellingPrice);
  const stockSnapshot = { quantity: drinkStock.quantity, productQty: drink.stockQuantity };
  let otherWaiterPassword: { id: string; passwordHash: string } | null = null;
  const occupiedTableIds: string[] = [];
  const createdHttpTableIds: string[] = [];

  try {
    await prisma.user.update({
      where: { id: manager.id },
      data: { pinHash: await hash(TEMP_PIN, 12), pinFailedAttempts: 0, pinLockedUntil: null },
    });
    await prisma.productLocationStock.update({
      where: { productId_locationId: { productId: drink.id, locationId: drinkStock.locationId } },
      data: { quantity: Math.max(drinkStock.quantity, 30) },
    });

    const users = await prisma.user.findMany({
      where: { active: true, email: { endsWith: "@example.com" } },
      select: { email: true, role: true },
      orderBy: { role: "asc" },
    });
    if (users.length === 0) throw new Error("No @example.com seed users found.");
    for (const user of users) {
      const session = await login(user.email);
      if (session.role !== user.role) throw new Error(`Role mismatch for ${user.email}`);
      results.push(`login ${user.role} ok`);
    }

    const badLogin = await (async () => {
      const jar: CookieJar = [];
      const csrfRes = await request("/api/auth/csrf", jar);
      const csrf = (await csrfRes.json()) as { csrfToken: string };
      const auth = await request("/api/auth/callback/credentials", jar, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          csrfToken: csrf.csrfToken,
          email: "waiter@example.com",
          password: "definitely-wrong-password",
          json: "true",
          callbackUrl: base,
        }),
      });
      const session = await request("/api/auth/session", jar);
      const data = (await session.json()) as { user?: { email?: string } };
      return { status: auth.status, hasUser: Boolean(data.user?.email) };
    })();
    if (badLogin.hasUser) throw new Error("Wrong password must not create a session");
    results.push("wrong password rejected");

    const waiter = await login("waiter@example.com");
    const reports = await request("/reports", waiter.jar);
    if (![307, 308, 302].includes(reports.status)) {
      throw new Error(`Waiter should be blocked from reports, got ${reports.status}`);
    }
    results.push("waiter blocked from /reports");

    const employees = await request("/employees", waiter.jar);
    if (![307, 308, 302].includes(employees.status)) {
      throw new Error(`Waiter should be blocked from employees, got ${employees.status}`);
    }
    results.push("waiter blocked from /employees");

    const unauth = await fetch(`${base}/api/sessions`, { method: "POST" });
    if (unauth.status !== 401) throw new Error(`Unauthenticated session POST should be 401, got ${unauth.status}`);
    results.push("unauthenticated sessions POST is 401");

    const salesIsolation = await jsonRequest("/api/sales", waiter.jar, "POST", { sessionId: "clxxxxxxxxxxxxxxxxxxxxx" });
    if (salesIsolation.status !== 400) {
      throw new Error(`Hospitality sessionId on /api/sales should be 400, got ${salesIsolation.status}`);
    }
    results.push("legacy /api/sales rejects sessionId");

    async function expectStatus(path: string, jar: CookieJar, method: string, body: unknown, status: number, label: string) {
      const res = await jsonRequest(path, jar, method, body);
      if (res.status !== status) {
        throw new Error(`${label}: expected ${status}, got ${res.status} ${await res.text()}`);
      }
    }

    await expectStatus("/api/sessions", waiter.jar, "POST", { channel: ServiceChannel.TABLE }, 400, "TABLE without table");
    await expectStatus("/api/sessions", waiter.jar, "POST", { channel: ServiceChannel.COUNTER }, 400, "COUNTER without destination");
    await expectStatus("/api/sessions", waiter.jar, "POST", { channel: ServiceChannel.TAKEAWAY }, 400, "TAKEAWAY without destination");
    await expectStatus("/api/sessions", waiter.jar, "POST", { channel: ServiceChannel.ACCOMMODATION }, 400, "ACCOMMODATION without room");
    await expectStatus("/api/sessions", waiter.jar, "POST", { channel: ServiceChannel.DELIVERY, customerName: "A" }, 400, "DELIVERY incomplete");
    results.push("channel required fields rejected");

    async function openChannel(payload: Record<string, unknown>) {
      const res = await jsonRequest("/api/sessions", waiter.jar, "POST", payload);
      const data = (await res.json()) as { id?: string; error?: string };
      if (res.status !== 201 || !data.id) throw new Error(`Channel ${String(payload.channel)} open failed: ${res.status} ${data.error}`);
      createdSessionIds.push(data.id);
      return data.id;
    }

    async function postOne(sessionId: string) {
      const res = await jsonRequest("/api/sessions/post", waiter.jar, "POST", {
        sessionId,
        idempotencyKey: randomUUID(),
        items: [{ productId: drink.id, quantity: 1, unitPrice: price }],
      });
      if (res.status !== 201) throw new Error(`Post to ${sessionId} failed: ${res.status} ${await res.text()}`);
    }

    async function settleAndReceipt(
      sessionId: string,
      body: Record<string, unknown>,
      receiptMustInclude: string[],
    ) {
      const res = await jsonRequest("/api/sessions/settle", waiter.jar, "POST", {
        sessionId,
        idempotencyKey: randomUUID(),
        ...body,
      });
      const sale = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !sale.id) throw new Error(`Settle ${sessionId} failed: ${res.status} ${sale.error}`);
      const receipt = await request(`/print/receipt/${sale.id}`, waiter.jar);
      if (receipt.status !== 200) throw new Error(`Receipt ${sale.id} should render, got ${receipt.status}`);
      const html = await receipt.text();
      for (const needle of receiptMustInclude) {
        if (!html.includes(needle)) throw new Error(`Receipt ${sale.id} missing "${needle}"`);
      }
      return sale.id;
    }

    const counterId = await openChannel({ channel: ServiceChannel.COUNTER, destinationLabel: "Bar Seat 1" });
    const takeawayId = await openChannel({ channel: ServiceChannel.TAKEAWAY, destinationLabel: "Takeaway #TEST-001" });
    const roomId = await openChannel({
      channel: ServiceChannel.ACCOMMODATION,
      destinationLabel: "311",
      customerName: "Room Guest",
    });
    const deliveryId = await openChannel({
      channel: ServiceChannel.DELIVERY,
      customerName: "Aline",
      customerPhone: "0780000000",
      deliveryAddress: "KN 4 Ave",
    });

    const deliveryGet = await request(`/api/sessions/${deliveryId}`, waiter.jar);
    const deliverySession = (await deliveryGet.json()) as {
      customerName?: string;
      customerPhone?: string;
      deliveryAddress?: string;
    };
    if (deliveryGet.status !== 200) throw new Error(`Delivery GET failed: ${deliveryGet.status}`);
    if (
      deliverySession.customerName !== "Aline" ||
      deliverySession.customerPhone !== "0780000000" ||
      deliverySession.deliveryAddress !== "KN 4 Ave"
    ) {
      throw new Error("Delivery customer data did not persist");
    }

    const cashHalf = Math.floor(price / 2);
    const cardHalf = price - cashHalf;
    await postOne(counterId);
    await settleAndReceipt(counterId, { payments: [{ method: PaymentMethod.CASH, amount: price, cashReceived: price }] }, ["Bar Seat 1"]);
    await postOne(takeawayId);
    await settleAndReceipt(
      takeawayId,
      {
        payments: [
          { method: PaymentMethod.CASH, amount: cashHalf, cashReceived: cashHalf },
          { method: PaymentMethod.CARD, amount: cardHalf },
        ],
      },
      ["Takeaway #TEST-001"],
    );
    await postOne(roomId);
    const roomSaleId = await settleAndReceipt(
      roomId,
      {
        payments: [],
        creditAmount: price,
        chargeToRoom: true,
        customerName: "Room Guest",
        managerUserId: manager.id,
        managerPin: TEMP_PIN,
      },
      ["311", "Room Guest"],
    );
    const roomBill = await prisma.creditBill.findFirst({ where: { saleId: roomSaleId } });
    if (!roomBill) throw new Error("Charge to room did not create a credit bill");
    const creditPayKey = randomUUID();
    const creditPayBody = {
      creditBillId: roomBill.id,
      amount: Number(roomBill.balance),
      method: PaymentMethod.CASH,
      idempotencyKey: creditPayKey,
    };
    const creditPay = await jsonRequest("/api/credit/payments", waiter.jar, "POST", creditPayBody);
    if (!creditPay.ok) throw new Error(`Credit repayment failed: ${creditPay.status} ${await creditPay.text()}`);
    const creditPayRetry = await jsonRequest("/api/credit/payments", waiter.jar, "POST", creditPayBody);
    if (!creditPayRetry.ok) throw new Error(`Credit repayment retry failed: ${creditPayRetry.status}`);
    if ((await prisma.creditPayment.count({ where: { creditBillId: roomBill.id } })) !== 1) {
      throw new Error("Credit repayment retry created a duplicate payment");
    }
    await postOne(deliveryId);
    await settleAndReceipt(deliveryId, { payments: [{ method: PaymentMethod.CASH, amount: price, cashReceived: price }] }, ["Aline", "KN 4 Ave"]);
    results.push("counter, takeaway, accommodation, delivery posted and receipted");

    const tablesRes = await request("/api/tables", waiter.jar);
    const tables = (await tablesRes.json()) as Array<{ id: string; status: string; name: string }>;
    let availableTable = Array.isArray(tables) ? tables.find((table) => table.status === "AVAILABLE") : undefined;
    if (!availableTable) {
      availableTable = await prisma.table.create({
        data: { name: `HTTP-T-${Date.now()}`, status: "AVAILABLE", sortOrder: 9999 },
      });
      createdHttpTableIds.push(availableTable.id);
    }
    occupiedTableIds.push(availableTable.id);
    const tableSessionId = await openChannel({ channel: ServiceChannel.TABLE, tableId: availableTable.id });
    const occupyAgain = await jsonRequest("/api/sessions", waiter.jar, "POST", {
      channel: ServiceChannel.TABLE,
      tableId: availableTable.id,
    });
    if (occupyAgain.status !== 409) {
      throw new Error(`Occupied table should be 409, got ${occupyAgain.status}`);
    }
    await postOne(tableSessionId);
    const tableItem = await prisma.sessionItem.findFirstOrThrow({ where: { round: { sessionId: tableSessionId } } });
    for (const status of [FulfillmentStatus.PREPARING, FulfillmentStatus.READY, FulfillmentStatus.SERVED]) {
      const patch = await jsonRequest("/api/fulfillment", waiter.jar, "PATCH", { itemId: tableItem.id, status });
      if (patch.status !== 200) throw new Error(`Fulfillment ${status} failed: ${patch.status} ${await patch.text()}`);
    }
    if ((await prisma.sessionItemFulfillmentHistory.count({ where: { sessionItemId: tableItem.id } })) !== 3) {
      throw new Error("Expected 3 fulfillment history rows");
    }
    await settleAndReceipt(
      tableSessionId,
      { payments: [{ method: PaymentMethod.CASH, amount: price, cashReceived: price }] },
      [availableTable.name],
    );
    results.push("table occupancy, fulfillment, settle, receipt");

    const open = await jsonRequest("/api/sessions", waiter.jar, "POST", {
      channel: ServiceChannel.WALK_IN,
      customerName: "P53 HTTP Walk-in",
    });
    const opened = (await open.json()) as { id?: string; error?: string };
    if (open.status !== 201 || !opened.id) throw new Error(`Walk-in open failed: ${open.status} ${opened.error}`);
    createdSessionIds.push(opened.id);
    results.push("walk-in session opened");

    const otherWaiter = await prisma.user.findFirst({
      where: { role: "WAITER", active: true, NOT: { email: "waiter@example.com" } },
      select: { id: true, email: true, passwordHash: true },
    });
    if (otherWaiter) {
      otherWaiterPassword = { id: otherWaiter.id, passwordHash: otherWaiter.passwordHash };
      await prisma.user.update({
        where: { id: otherWaiter.id },
        data: { passwordHash: await hash(password, 12) },
      });
      const waiterB = await login(otherWaiter.email, password);
      const stolenGet = await request(`/api/sessions/${opened.id}`, waiterB.jar);
      if (stolenGet.status !== 403) throw new Error(`Waiter B GET should be 403, got ${stolenGet.status}`);
      await expectStatus(
        "/api/sessions/post",
        waiterB.jar,
        "POST",
        { sessionId: opened.id, idempotencyKey: randomUUID(), items: [{ productId: drink.id, quantity: 1, unitPrice: price }] },
        403,
        "Waiter B post",
      );
      await expectStatus(
        "/api/sessions/handover",
        waiterB.jar,
        "POST",
        {
          sessionId: opened.id,
          newWaiterId: waiterB.id,
          reason: "unauthorized takeover",
          managerUserId: manager.id,
          managerPin: TEMP_PIN,
        },
        403,
        "Waiter B handover",
      );
      await expectStatus(
        "/api/sessions/settle",
        waiterB.jar,
        "POST",
        { sessionId: opened.id, idempotencyKey: randomUUID(), payments: [{ method: PaymentMethod.CASH, amount: price }] },
        403,
        "Waiter B settle",
      );
      results.push("waiter B blocked from waiter A session");
    } else {
      results.push("waiter B HTTP ownership skipped — only one waiter account");
    }

    const postKey = randomUUID();
    const postBody = {
      sessionId: opened.id,
      idempotencyKey: postKey,
      items: [{ productId: drink.id, quantity: 1, unitPrice: price }],
    };
    const posted = await jsonRequest("/api/sessions/post", waiter.jar, "POST", postBody);
    if (posted.status !== 201) throw new Error(`Post order failed: ${posted.status} ${await posted.text()}`);
    const retry = await jsonRequest("/api/sessions/post", waiter.jar, "POST", postBody);
    if (retry.status !== 201) throw new Error(`Idempotent post retry failed: ${retry.status}`);
    const rounds = await prisma.orderRound.count({ where: { sessionId: opened.id } });
    if (rounds !== 1) throw new Error(`Expected one round after retry, got ${rounds}`);
    results.push("post order idempotent retry");

    const postedItem = await prisma.sessionItem.findFirst({ where: { round: { sessionId: opened.id } } });
    if (postedItem) {
      const skip = await jsonRequest("/api/fulfillment", waiter.jar, "PATCH", {
        itemId: postedItem.id,
        status: FulfillmentStatus.SERVED,
      });
      if (skip.status !== 400) throw new Error(`Invalid fulfillment skip should be 400, got ${skip.status}`);
      results.push("fulfillment skip rejected");

    const wrongPin = await jsonRequest("/api/sessions/adjustments/void", waiter.jar, "POST", {
      sessionItemId: postedItem.id,
      reason: "guest changed mind",
      managerUserId: manager.id,
      managerPin: "0000",
    });
    if (wrongPin.status !== 403) throw new Error(`Wrong manager PIN should be 403, got ${wrongPin.status}`);
    await expectStatus(
      "/api/sessions/adjustments/void",
      waiter.jar,
      "POST",
      { sessionItemId: postedItem.id, reason: "guest changed mind" },
      400,
      "void without approval fields",
    );
    if (otherWaiterPassword) {
      const waiterB = await login(
        (await prisma.user.findUniqueOrThrow({ where: { id: otherWaiterPassword.id }, select: { email: true } })).email,
        password,
      );
      await expectStatus(
        "/api/sessions/adjustments/void",
        waiterB.jar,
        "POST",
        {
          sessionItemId: postedItem.id,
          reason: "guest changed mind",
          managerUserId: manager.id,
          managerPin: TEMP_PIN,
        },
        403,
        "Waiter B void",
      );
    }
    }

    const creditNoPin = await jsonRequest("/api/sessions/settle", waiter.jar, "POST", {
      sessionId: opened.id,
      idempotencyKey: randomUUID(),
      payments: [],
      creditAmount: price,
      customerName: "Tab",
    });
    if (creditNoPin.status !== 403) throw new Error(`Credit without PIN should be 403, got ${creditNoPin.status}`);
    const waiterApprover = await jsonRequest("/api/sessions/settle", waiter.jar, "POST", {
      sessionId: opened.id,
      idempotencyKey: randomUUID(),
      payments: [],
      creditAmount: price,
      customerName: "Tab",
      managerUserId: waiter.id,
      managerPin: TEMP_PIN,
    });
    if (waiterApprover.status !== 403) {
      throw new Error(`Waiter as approver should be 403, got ${waiterApprover.status}`);
    }
    results.push("credit requires verified manager PIN");

    const overpay = await jsonRequest("/api/sessions/settle", waiter.jar, "POST", {
      sessionId: opened.id,
      idempotencyKey: randomUUID(),
      payments: [{ method: PaymentMethod.CASH, amount: price + 500 }],
    });
    if (overpay.status !== 400) throw new Error(`Overpayment should be 400, got ${overpay.status}`);
    if (await prisma.sale.count({ where: { sessionId: opened.id } })) {
      throw new Error("Overpayment created a sale");
    }
    results.push("overpayment rejected");

    const settleKey = randomUUID();
    const settleBody = {
      sessionId: opened.id,
      idempotencyKey: settleKey,
      payments: [{ method: PaymentMethod.CASH, amount: price, cashReceived: price }],
    };
    const settled = await jsonRequest("/api/sessions/settle", waiter.jar, "POST", settleBody);
    const sale = (await settled.json()) as { id?: string; error?: string };
    if (!settled.ok || !sale.id) throw new Error(`Settle failed: ${settled.status} ${sale.error}`);
    const settledAgain = await jsonRequest("/api/sessions/settle", waiter.jar, "POST", settleBody);
    const again = (await settledAgain.json()) as { id?: string };
    if (again.id !== sale.id) throw new Error("Duplicate settlement created a different sale");
    results.push("walk-in settled with idempotent retry");

    const receipt = await request(`/print/receipt/${sale.id}`, waiter.jar);
    if (receipt.status !== 200) throw new Error(`Receipt should render, got ${receipt.status}`);
    results.push("receipt reachable");

    const owner = await login("owner@example.com");
    const ownerPos = await request("/pos", owner.jar);
    if (ownerPos.status !== 200) throw new Error(`Owner POS should load, got ${ownerPos.status}`);
    const ownerReports = await request("/reports", owner.jar);
    if (ownerReports.status !== 200) throw new Error(`Owner reports should load, got ${ownerReports.status}`);
    const barQueue = await request("/fulfillment/bar", owner.jar);
    if (barQueue.status !== 200) throw new Error(`Bar queue should load, got ${barQueue.status}`);
    const kitchenQueue = await request("/fulfillment/kitchen", owner.jar);
    if (kitchenQueue.status !== 200) throw new Error(`Kitchen queue should load, got ${kitchenQueue.status}`);
    const fulfillmentAnon = await fetch(`${base}/fulfillment/bar`, { redirect: "manual" });
    if (![307, 308, 302].includes(fulfillmentAnon.status)) {
      throw new Error(`Anonymous fulfillment should redirect, got ${fulfillmentAnon.status}`);
    }
    results.push("owner POS, reports, and bar/kitchen queues load");

    console.log(JSON.stringify({ ok: true, results, cleanedSessions: createdSessionIds.length }, null, 2));
  } finally {
    if (createdSessionIds.length > 0) {
      const items = await prisma.sessionItem.findMany({
        where: { round: { sessionId: { in: createdSessionIds } } },
        select: { id: true },
      });
      await prisma.sale.deleteMany({ where: { sessionId: { in: createdSessionIds } } });
      if (items.length > 0) {
        await prisma.inventoryMovement.deleteMany({ where: { referenceId: { in: items.map((item) => item.id) } } });
      }
      await prisma.orderAdjustment.deleteMany({ where: { sessionId: { in: createdSessionIds } } });
      await prisma.serviceSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    }
    if (occupiedTableIds.length > 0) {
      await prisma.table.updateMany({
        where: { id: { in: occupiedTableIds } },
        data: { status: "AVAILABLE" },
      });
    }
    if (createdHttpTableIds.length > 0) {
      await prisma.table.deleteMany({ where: { id: { in: createdHttpTableIds } } });
    }
    await prisma.user.update({ where: { id: manager.id }, data: pinSnapshot });
    if (otherWaiterPassword) {
      await prisma.user.update({
        where: { id: otherWaiterPassword.id },
        data: { passwordHash: otherWaiterPassword.passwordHash },
      });
    }
    await prisma.productLocationStock.update({
      where: { productId_locationId: { productId: drink.id, locationId: drinkStock.locationId } },
      data: { quantity: stockSnapshot.quantity },
    });
    await prisma.product.update({
      where: { id: drink.id },
      data: { stockQuantity: stockSnapshot.productQty },
    });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
