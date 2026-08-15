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
    headers: { ...(init.headers ?? {}), cookie: cookieHeader(jar) },
  });
  store(jar, response.headers);
  return response;
}

async function login(email: string) {
  const jar: CookieJar = [];
  const csrfRes = await request("/api/auth/csrf", jar);
  const csrf = (await csrfRes.json()) as { csrfToken: string };
  const auth = await request("/api/auth/callback/credentials", jar, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      json: "true",
      callbackUrl: base,
    }),
  });
  if (auth.status >= 400) throw new Error(`Login failed for ${email}: ${auth.status}`);
  const session = await request("/api/auth/session", jar);
  const data = (await session.json()) as { user?: { email?: string; role?: string } };
  if (data.user?.email !== email) throw new Error(`Session was not established for ${email}.`);
  return { jar, role: data.user.role! };
}

async function main() {
  const results: string[] = [];
  const food = await prisma.product.findFirst({
    where: { active: true, trackInventory: false, variants: { some: { active: true } } },
    include: { variants: { where: { active: true }, take: 1 } },
  });
  const drink = await prisma.product.findFirst({
    where: { active: true, trackInventory: true, category: { name: "Drinks" }, variants: { some: { active: true } } },
    include: { variants: { where: { active: true }, take: 1 }, category: true },
  });
  if (!food?.variants[0] || !drink?.variants[0]) throw new Error("Need a food item and a tracked drink.");

  if (drink.stockQuantity < 5) {
    await prisma.product.update({ where: { id: drink.id }, data: { stockQuantity: 5 } });
    results.push(`test fixture: set ${drink.name} opening stock to 5`);
  }
  const opening = (await prisma.product.findUniqueOrThrow({ where: { id: drink.id } })).stockQuantity;
  const foodOpening = food.stockQuantity;

  const waiter = await login("waiter@example.com");
  results.push("waiter login");
  const pos = await request("/pos", waiter.jar);
  if (pos.status !== 200) throw new Error(`POS failed: ${pos.status}`);
  results.push("waiter opened POS");

  const checkout = await request("/api/sales", waiter.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        { variantId: food.variants[0].id, quantity: 1 },
        { variantId: drink.variants[0].id, quantity: 1 },
      ],
      paymentMethod: "CASH",
      amountPaid: food.variants[0].sellingPrice.add(drink.variants[0].sellingPrice).toFixed(2),
    }),
  });
  const sale = (await checkout.json()) as { id?: string; receiptNumber?: string; error?: string };
  if (checkout.status !== 201 || !sale.id) throw new Error(`Checkout failed: ${checkout.status} ${sale.error}`);
  results.push(`cash sale ${sale.receiptNumber}`);

  const stored = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id }, include: { items: true } });
  if (stored.items.length !== 2) throw new Error("Sale did not store both items.");
  if (!stored.items.some((item) => item.productVariantId === drink.variants[0].id)) {
    throw new Error("Tracked drink variant was not stored on the sale.");
  }

  const drinkAfterSale = await prisma.product.findUniqueOrThrow({ where: { id: drink.id } });
  const foodAfterSale = await prisma.product.findUniqueOrThrow({ where: { id: food.id } });
  if (drinkAfterSale.stockQuantity !== opening - 1) throw new Error("Tracked drink stock did not decrease.");
  if (foodAfterSale.stockQuantity !== foodOpening) throw new Error("Untracked food stock changed.");
  results.push("tracked stock decreased; food stock unchanged");

  const receipt = await request(`/print/receipt/${sale.id}`, waiter.jar);
  const html = await receipt.text();
  if (receipt.status !== 200 || !html.includes("B-ZENITH") || !html.includes(stored.receiptNumber)) {
    throw new Error("Receipt reprint failed.");
  }
  results.push("receipt reprinted");

  const inventory = await login("inventory@example.com");
  const purchase = await request("/api/purchases", inventory.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      supplierId: null,
      referenceNumber: `BIZ-${Date.now()}`,
      items: [{ productId: drink.id, quantity: 3, unitCost: "500.00" }],
    }),
  });
  const purchaseBody = (await purchase.json()) as { id?: string; error?: string };
  if (purchase.status !== 201 || !purchaseBody.id) throw new Error(`Purchase failed: ${purchaseBody.error}`);
  const drinkAfterPurchase = await prisma.product.findUniqueOrThrow({ where: { id: drink.id } });
  if (drinkAfterPurchase.stockQuantity !== opening - 1 + 3) throw new Error("Purchase did not increase stock.");
  results.push("inventory received purchase and stock increased");

  const admin = await login("admin@example.com");
  const reports = await request("/reports", admin.jar);
  if (reports.status !== 200) throw new Error(`Admin reports failed: ${reports.status}`);
  const reportHtml = await reports.text();
  if (!reportHtml.includes(stored.receiptNumber) && !reportHtml.includes("Daily sales")) {
    throw new Error("Reports page did not render.");
  }
  const saleStillThere = await prisma.sale.findUnique({ where: { id: sale.id } });
  if (!saleStillThere) throw new Error("Sale missing from database during reports check.");
  results.push("admin reports opened; sale still in database");

  const drinkLine = stored.items.find((item) => item.productId === drink.id)!;
  const returnRes = await request("/api/returns", admin.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      saleId: sale.id,
      reason: "Business readiness return test",
      items: [{ saleItemId: drinkLine.id, quantity: 1 }],
    }),
  });
  const returnBody = (await returnRes.json()) as { returnNumber?: string; error?: string };
  if (returnRes.status !== 201) throw new Error(`Return failed: ${returnRes.status} ${returnBody.error}`);
  const original = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
  if (!original) throw new Error("Original sale was deleted.");
  const drinkAfterReturn = await prisma.product.findUniqueOrThrow({ where: { id: drink.id } });
  if (drinkAfterReturn.stockQuantity !== opening + 3) throw new Error("Return did not restore tracked stock.");
  results.push(`return ${returnBody.returnNumber}; original sale ${original.status} retained`);

  const audits = await prisma.auditLog.findMany({
    where: {
      action: { in: ["LOGIN", "SALE_COMPLETED", "CREATE_PURCHASE", "CREATE_RETURN"] },
      createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
    },
  });
  const actions = new Set(audits.map((log) => log.action));
  for (const action of ["LOGIN", "SALE_COMPLETED", "CREATE_PURCHASE", "CREATE_RETURN"]) {
    if (!actions.has(action)) throw new Error(`Missing audit action ${action}`);
  }
  results.push("audit records exist for login, sale, purchase, and return");

  console.log(JSON.stringify({ ok: true, sale: stored.receiptNumber, drink: drink.name, food: food.name, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
