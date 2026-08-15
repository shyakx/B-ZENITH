import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const password = process.env.SEED_USER_PASSWORD ?? "BZenith@2026";

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

async function login(email: string) {
  const jar: CookieJar = [];
  const csrfRes = await request("/api/auth/csrf", jar);
  const csrf = (await csrfRes.json()) as { csrfToken: string };
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password,
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
  const data = (await session.json()) as { user?: { email?: string; role?: string } };
  if (data.user?.email !== email) throw new Error(`Session was not established for ${email}.`);
  return { jar, role: data.user.role };
}

async function main() {
  const results: string[] = [];

  for (const email of ["owner@example.com", "admin@example.com", "waiter@example.com", "inventory@example.com"]) {
    const { role } = await login(email);
    results.push(`login ${email} -> ${role}`);
  }

  const waiter = await login("waiter@example.com");
  const reports = await request("/reports", waiter.jar);
  if (![307, 308, 302].includes(reports.status) || !reports.headers.get("location")?.includes("/unauthorized")) {
    throw new Error(`Waiter should be blocked from reports, got ${reports.status} ${reports.headers.get("location")}`);
  }
  results.push("waiter blocked from /reports");

  const employees = await request("/employees", waiter.jar);
  if (![307, 308, 302].includes(employees.status)) {
    throw new Error(`Waiter should be blocked from employees, got ${employees.status}`);
  }
  results.push("waiter blocked from /employees");

  const inventory = await login("inventory@example.com");
  const pos = await request("/pos", inventory.jar);
  if (![307, 308, 302].includes(pos.status)) {
    throw new Error(`Inventory should be blocked from POS, got ${pos.status}`);
  }
  results.push("inventory blocked from /pos");

  const saleAttempt = await request("/api/sales", inventory.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ variantId: "clxxxxxxxxxxxxxxxxxxxxx", quantity: 1 }], paymentMethod: "CASH", amountPaid: "1" }),
  });
  if (saleAttempt.status !== 403) throw new Error(`Inventory sale POST should be 403, got ${saleAttempt.status}`);
  results.push("inventory cannot complete sales");

  const variant = await prisma.productVariant.findFirst({
    where: { active: true, product: { active: true } },
    select: { id: true, sellingPrice: true },
  });
  if (!variant) throw new Error("No variant for checkout.");

  const checkout = await request("/api/sales", waiter.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ variantId: variant.id, quantity: 1 }],
      paymentMethod: "CASH",
      amountPaid: variant.sellingPrice.toFixed(2),
    }),
  });
  const sale = (await checkout.json()) as { id?: string; error?: string };
  if (checkout.status !== 201 || !sale.id) throw new Error(`Waiter checkout failed: ${checkout.status} ${sale.error}`);
  results.push(`waiter checkout ${sale.id}`);

  const ownerForReturn = await login("owner@example.com");
  const saleRecord = await prisma.sale.findUniqueOrThrow({
    where: { id: sale.id },
    include: { items: true },
  });
  const returnRes = await request("/api/returns", ownerForReturn.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      saleId: sale.id,
      reason: "E2E verification return",
      items: [{ saleItemId: saleRecord.items[0]!.id, quantity: 1 }],
    }),
  });
  const returnBody = (await returnRes.json()) as { returnNumber?: string; error?: string };
  if (returnRes.status !== 201 || !returnBody.returnNumber) {
    throw new Error(`Return failed: ${returnRes.status} ${returnBody.error}`);
  }
  const returnedSale = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
  if (returnedSale.status !== "RETURNED" && returnedSale.status !== "PARTIALLY_RETURNED") {
    throw new Error(`Sale was not marked returned: ${returnedSale.status}`);
  }
  results.push(`return processed ${returnBody.returnNumber}`);

  const receipt = await request(`/print/receipt/${sale.id}`, waiter.jar);
  if (receipt.status !== 200) throw new Error(`Receipt page failed: ${receipt.status}`);
  const html = await receipt.text();
  if (!html.includes("B-ZENITH") || !html.includes("Cloud Sync")) {
    throw new Error("Receipt is missing branding.");
  }
  results.push("receipt rendered with branding");

  const owner = await login("owner@example.com");
  const dashboard = await request("/dashboard", owner.jar);
  if (dashboard.status !== 200) throw new Error(`Owner dashboard failed: ${dashboard.status}`);
  results.push("owner dashboard ok");

  const admin = await login("admin@example.com");
  const adminDash = await request("/dashboard", admin.jar);
  if (adminDash.status !== 200) throw new Error(`Admin dashboard failed: ${adminDash.status}`);
  const adminEmployees = await request("/employees", admin.jar);
  if (![307, 308, 302].includes(adminEmployees.status)) {
    throw new Error(`Admin should be blocked from employees, got ${adminEmployees.status}`);
  }
  results.push("admin dashboard ok and blocked from employees");

  const inventoryPage = await request("/inventory", inventory.jar);
  if (inventoryPage.status !== 200) throw new Error(`Inventory page failed: ${inventoryPage.status}`);
  const inventoryHtml = await inventoryPage.text();
  if (!inventoryHtml.includes("Tracked inventory") || !inventoryHtml.includes("Inventory tracking disabled")) {
    throw new Error("Inventory page does not distinguish tracked and untracked products.");
  }
  if (!inventoryHtml.includes("Physical stock take")) {
    throw new Error("Inventory page is missing the stock-take workflow.");
  }
  results.push("inventory can open inventory");

  const waiterStockTake = await request("/api/inventory/stock-take", waiter.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: variant.id,
      countedQuantity: 1,
      reason: "Waiter should not stock take",
    }),
  });
  if (waiterStockTake.status !== 403) {
    throw new Error(`Waiter stock take should be 403, got ${waiterStockTake.status}`);
  }
  results.push("waiter cannot record stock take");

  const trackedDrink = await prisma.product.findFirst({
    where: { active: true, trackInventory: true, category: { name: "Drinks" } },
  });
  const untrackedFood = await prisma.product.findFirst({
    where: { active: true, trackInventory: false },
  });
  if (!trackedDrink || !untrackedFood) throw new Error("Need a tracked drink and an untracked product.");

  const untrackedTake = await request("/api/inventory/stock-take", inventory.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: untrackedFood.id,
      countedQuantity: 1,
      reason: "Must not track food",
    }),
  });
  if (untrackedTake.status !== 409) {
    throw new Error(`Untracked stock take should be 409, got ${untrackedTake.status}`);
  }
  results.push("untracked product rejected from stock take");

  const originalStock = trackedDrink.stockQuantity;
  const countedStock = originalStock + 1;
  const take = await request("/api/inventory/stock-take", inventory.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: trackedDrink.id,
      countedQuantity: countedStock,
      reason: "E2E controlled stock take",
    }),
  });
  const takeBody = (await take.json()) as { error?: string; previousQuantity?: number; countedQuantity?: number; adjustment?: number };
  if (take.status !== 200 || takeBody.adjustment !== 1) {
    throw new Error(`Stock take failed: ${take.status} ${takeBody.error}`);
  }
  const afterTake = await prisma.product.findUniqueOrThrow({ where: { id: trackedDrink.id } });
  if (afterTake.stockQuantity !== countedStock) throw new Error("Stock take did not update quantity.");
  const stockTakeAudit = await prisma.auditLog.findFirst({
    where: { action: "STOCK_TAKE", entityId: trackedDrink.id },
    orderBy: { createdAt: "desc" },
  });
  if (!stockTakeAudit) throw new Error("Stock take did not write an audit record.");
  results.push("stock take recorded with audit");

  const restore = await request("/api/inventory/stock-take", inventory.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: trackedDrink.id,
      countedQuantity: originalStock,
      reason: "E2E restore original stock",
      confirmNegative: true,
    }),
  });
  const restoreBody = (await restore.json()) as { error?: string; adjustment?: number };
  if (restore.status !== 200 || restoreBody.adjustment !== -1) {
    throw new Error(`Stock restore failed: ${restore.status} ${restoreBody.error}`);
  }
  const restored = await prisma.product.findUniqueOrThrow({ where: { id: trackedDrink.id } });
  if (restored.stockQuantity !== originalStock) {
    throw new Error("Controlled stock-take test did not restore original quantity.");
  }
  results.push("stock take restored original quantity");

  const product = await prisma.product.findFirst({
    where: { active: true, trackInventory: true },
    select: { id: true, stockQuantity: true },
  });
  if (!product) throw new Error("No tracked product for purchase.");
  const purchase = await request("/api/purchases", inventory.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      supplierId: null,
      referenceNumber: `E2E-PO-${Date.now()}`,
      items: [{ productId: product.id, quantity: 2, unitCost: "500.00" }],
    }),
  });
  const purchaseBody = (await purchase.json()) as { id?: string; error?: string };
  if (purchase.status !== 201 || !purchaseBody.id) throw new Error(`Purchase failed: ${purchase.status} ${purchaseBody.error}`);
  const afterStock = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, select: { stockQuantity: true } });
  if (afterStock.stockQuantity !== product.stockQuantity + 2) throw new Error("Purchase did not increase stock.");
  const restorePurchase = await request("/api/inventory/stock-take", inventory.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: product.id,
      countedQuantity: product.stockQuantity,
      reason: "E2E restore purchase fixture",
      confirmNegative: true,
    }),
  });
  if (restorePurchase.status !== 200) {
    throw new Error(`Could not restore purchase fixture stock: ${restorePurchase.status}`);
  }
  results.push("purchase received and stock increased");

  const badJar: CookieJar = [];
  const csrfRes = await request("/api/auth/csrf", badJar);
  const csrf = (await csrfRes.json()) as { csrfToken: string };
  const failed = await request("/api/auth/callback/credentials", badJar, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email: "owner@example.com",
      password: "wrong-password-99",
      json: "true",
      callbackUrl: base,
    }),
  });
  const failedSession = await request("/api/auth/session", badJar);
  const failedData = (await failedSession.json()) as { user?: { email?: string } };
  if (failed.status < 400 && failedData.user?.email) throw new Error("Invalid password was accepted.");
  results.push("invalid password rejected");

  const unauth = await fetch(`${base}/api/sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ variantId: variant.id, quantity: 1 }], paymentMethod: "CASH", amountPaid: "1" }),
  });
  if (unauth.status !== 401) throw new Error(`Unauthenticated sale should be 401, got ${unauth.status}`);
  results.push("unauthenticated sale rejected");

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
