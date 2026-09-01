/**
 * PRODUCTION CATALOG IMPORT — NON-DESTRUCTIVE
 *
 * Imports the approved menu catalog plus Kitchen Stores materials into a NEW
 * production database. Development opening-stock quantities are never imported.
 *
 * NEVER:
 * - delete / deleteMany / truncate
 * - prisma migrate reset / prisma db push
 * - modify users, tables, orders, payments, credits, purchases, movements, audit
 * - modify OrderSequence values
 * - overwrite existing Settings
 * - reset stockQuantity on an existing product
 *
 * NEW products are created with stockQuantity = 0.
 * EXISTING products keep their current stockQuantity.
 *
 * Authorization:
 *   PRODUCTION_CATALOG_IMPORT_CONFIRM=YES   required for writes
 *   PRODUCTION_CATALOG_DRY_RUN=YES          inspect only, zero writes
 *
 * Do not run this against the old Vercel production database
 * (Neon project quiet-feather-99399801). Intended production target is
 * b-zenith-app-db / shiny-thunder-16809110 / neondb — only after explicit approval.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import {
  CATALOG_CATEGORIES,
  EXPECTED_CATEGORY_COUNT,
  EXPECTED_PRODUCT_COUNT,
  EXPECTED_TRACKED_PRODUCT_COUNT,
  EXPECTED_UNTRACKED_PRODUCT_COUNT,
  assertCatalogIntegrity,
  flattenCatalogProducts,
} from "./catalog-data";

const CONFIRM_VALUE = "YES";
const DRY_RUN_VALUE = "YES";
const BLOCKED_HOST_MARKERS = ["quiet-feather-99399801"];
const LEGACY_TABLE_NAMES = ["Sale", "Table", "Account", "Session", "VerificationToken"];
const LEGACY_ROLE_LABELS = ["OWNER", "BILLIARD"];

type SafeConnectionMeta = {
  provider: string;
  host: string;
  port: string | null;
  database: string;
};

type CatalogCounts = {
  created: number;
  updated: number;
  preserved: number;
};

const prisma = new PrismaClient();

function isDryRun() {
  return process.env.PRODUCTION_CATALOG_DRY_RUN === DRY_RUN_VALUE;
}

function isConfirmed() {
  return process.env.PRODUCTION_CATALOG_IMPORT_CONFIRM === CONFIRM_VALUE;
}

function safeConnectionMeta(databaseUrl: string): SafeConnectionMeta {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid connection URL.");
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] ?? "");
  return {
    provider: parsed.protocol.replace(/:$/, "") || "postgresql",
    host: parsed.hostname,
    port: parsed.port || null,
    database,
  };
}

function assertNotBlockedTarget(databaseUrl: string, meta: SafeConnectionMeta) {
  const haystack = `${databaseUrl}\n${meta.host}\n${meta.database}`.toLowerCase();
  for (const marker of BLOCKED_HOST_MARKERS) {
    if (haystack.includes(marker.toLowerCase())) {
      throw new Error(
        "Refusing to run against the old production database (quiet-feather-99399801). The old database must remain untouched.",
      );
    }
  }
}

function printBanner() {
  console.log("");
  console.log("============================================================");
  console.log("  PRODUCTION CATALOG IMPORT — NON-DESTRUCTIVE");
  console.log("============================================================");
  console.log("  Creates/upserts approved categories and products only.");
  console.log("  New products: stockQuantity = 0");
  console.log("  Existing products: stockQuantity preserved");
  console.log("  No users, tables, orders, payments, or stock movements.");
  console.log("============================================================");
  console.log("");
}

function printConnectionMeta(meta: SafeConnectionMeta) {
  console.log("Connection metadata (credentials omitted):");
  console.log(`  provider: ${meta.provider}`);
  console.log(`  host:     ${meta.host}`);
  if (meta.port) console.log(`  port:     ${meta.port}`);
  console.log(`  database: ${meta.database || "(unknown)"}`);
  const local =
    meta.host === "localhost" ||
    meta.host === "127.0.0.1" ||
    meta.host === "::1";
  if (!local) {
    console.log("  note:     remote host — intended production target is");
    console.log("            b-zenith-app-db / shiny-thunder-16809110 / neondb");
    console.log("            NEVER the old Vercel production database.");
  }
  console.log("");
}

async function assertNotLegacySchema() {
  const legacyTables = await prisma.$queryRaw<Array<{ table_name: string }>>(Prisma.sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN (${Prisma.join(LEGACY_TABLE_NAMES)})
  `);
  if (legacyTables.length > 0) {
    throw new Error(
      "Refusing to run against a legacy/old production schema. The old database must remain untouched.",
    );
  }

  const legacyRoles = await prisma.$queryRaw<Array<{ enumlabel: string }>>(Prisma.sql`
    SELECT e.enumlabel
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Role'
      AND e.enumlabel IN (${Prisma.join(LEGACY_ROLE_LABELS)})
  `);
  if (legacyRoles.length > 0) {
    throw new Error(
      "Refusing to run against a legacy Role enum (OWNER/BILLIARD). The old database must remain untouched.",
    );
  }
}

async function snapshotProtectedState() {
  const [orderSequences, settings, inventoryMovements, orders, payments, users, tables] =
    await Promise.all([
      prisma.orderSequence.findMany({ orderBy: { id: "asc" } }),
      prisma.setting.findMany({ orderBy: { key: "asc" } }),
      prisma.inventoryMovement.count(),
      prisma.order.count(),
      prisma.payment.count(),
      prisma.user.count(),
      prisma.serviceTable.count(),
    ]);
  return {
    orderSequences: JSON.stringify(orderSequences),
    settings: JSON.stringify(settings),
    inventoryMovements,
    orders,
    payments,
    users,
    tables,
  };
}

async function findProductInCategory(
  client: Prisma.TransactionClient | PrismaClient,
  categoryId: string,
  name: string,
) {
  const matches = await client.product.findMany({
    where: { categoryId, name },
  });
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous product identity: ${matches.length} products named "${name}" in the same category. Refusing to guess.`,
    );
  }
  return matches[0] ?? null;
}

async function planCatalogChanges() {
  const products = flattenCatalogProducts();
  let categoriesWouldCreate = 0;
  let categoriesWouldUpdate = 0;
  let productsWouldCreate = 0;
  let productsWouldUpdate = 0;

  const existingCategories = await prisma.category.findMany({
    select: { id: true, name: true },
  });
  const categoryByName = new Map(existingCategories.map((row) => [row.name, row]));

  for (const category of CATALOG_CATEGORIES) {
    if (categoryByName.has(category.name)) categoriesWouldUpdate += 1;
    else categoriesWouldCreate += 1;
  }

  for (const product of products) {
    const category = categoryByName.get(product.categoryName);
    if (!category) {
      productsWouldCreate += 1;
      continue;
    }
    const existing = await findProductInCategory(prisma, category.id, product.name);
    if (existing) productsWouldUpdate += 1;
    else productsWouldCreate += 1;
  }

  return {
    categoriesWouldCreate,
    categoriesWouldUpdate,
    productsWouldCreate,
    productsWouldUpdate,
  };
}

async function importCatalog(tx: Prisma.TransactionClient): Promise<CatalogCounts> {
  const counts: CatalogCounts = { created: 0, updated: 0, preserved: 0 };
  const categoryIds: Record<string, string> = {};
  const units = Object.fromEntries((await tx.unit.findMany()).map((unit) => [unit.code, unit.id]));
  const locations = Object.fromEntries(
    (await tx.stockLocation.findMany()).map((location) => [location.code, location.id]),
  );

  for (const [index, category] of CATALOG_CATEGORIES.entries()) {
    const row = await tx.category.upsert({
      where: { name: category.name },
      create: {
        name: category.name,
        area: category.area,
        sortOrder: index,
      },
      update: {
        area: category.area,
        sortOrder: index,
      },
    });
    categoryIds[category.name] = row.id;
  }

  for (const product of flattenCatalogProducts()) {
    const categoryId = categoryIds[product.categoryName];
    if (!categoryId) {
      throw new Error(`Approved category "${product.categoryName}" was not found after upsert.`);
    }
    const baseUnitId = units[product.baseUnitCode] ?? null;
    const defaultStockLocationId = product.defaultLocationCode
      ? (locations[product.defaultLocationCode] ?? null)
      : null;
    const typeFields = {
      productType: product.productType,
      sellOnPos: product.sellOnPos,
      baseUnitId,
      defaultStockLocationId,
    };

    const existing = await findProductInCategory(tx, categoryId, product.name);
    if (!existing) {
      const created = await tx.product.create({
        data: {
          name: product.name,
          categoryId,
          sellingPrice: product.sellingPrice,
          trackInventory: product.trackInventory,
          active: product.active,
          sortOrder: product.sortOrder,
          stockQuantity: 0,
          ...typeFields,
        },
      });
      if (product.trackInventory) {
        await ensureZeroStocks(tx, created.id, locations);
      }
      counts.created += 1;
      continue;
    }

    await tx.product.update({
      where: { id: existing.id },
      data: {
        name: product.name,
        categoryId,
        sellingPrice: product.sellingPrice,
        trackInventory: product.trackInventory,
        active: product.active,
        sortOrder: product.sortOrder,
        ...typeFields,
      },
    });
    if (product.trackInventory) {
      await ensureZeroStocks(tx, existing.id, locations);
    }
    counts.updated += 1;
    counts.preserved += 1;
  }

  return counts;
}

async function ensureZeroStocks(
  tx: Prisma.TransactionClient,
  productId: string,
  locations: Record<string, string>,
) {
  for (const locationId of Object.values(locations)) {
    await tx.productStock.upsert({
      where: { productId_locationId: { productId, locationId } },
      create: { productId, locationId, quantity: 0 },
      update: {},
    });
  }
}

async function verifyAfterImport(
  counts: CatalogCounts,
  before: Awaited<ReturnType<typeof snapshotProtectedState>>,
) {
  const approvedNames = CATALOG_CATEGORIES.map((category) => category.name);
  const approvedKeys = new Set(
    flattenCatalogProducts().map((product) => `${product.categoryName}::${product.name}`),
  );
  const [allCategories, allProducts, duplicateCategoryNames, duplicatePairs, after] = await Promise.all([
    prisma.category.findMany({ select: { name: true } }),
    prisma.product.findMany({
      select: {
        name: true,
        stockQuantity: true,
        trackInventory: true,
        category: { select: { name: true } },
      },
    }),
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n
      FROM (
        SELECT name FROM "Category"
        GROUP BY name
        HAVING COUNT(*) > 1
      ) d
    `,
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n
      FROM (
        SELECT p."categoryId", p.name
        FROM "Product" p
        GROUP BY p."categoryId", p.name
        HAVING COUNT(*) > 1
      ) d
    `,
    snapshotProtectedState(),
  ]);

  const approvedCategoryCount = allCategories.filter((row) => approvedNames.includes(row.name)).length;
  const approvedProducts = allProducts.filter((row) =>
    approvedKeys.has(`${row.category.name}::${row.name}`),
  );
  const trackedCount = approvedProducts.filter((row) => row.trackInventory).length;
  const untrackedCount = approvedProducts.length - trackedCount;
  const zeroStockCount = approvedProducts.filter((row) => row.stockQuantity === 0).length;
  const negativeStockCount = approvedProducts.filter((row) => row.stockQuantity < 0).length;
  const productsOutsideApproved = allProducts.filter(
    (row) => !approvedNames.includes(row.category.name),
  ).length;
  const missingApproved = flattenCatalogProducts().filter(
    (product) => !approvedProducts.some((row) => row.category.name === product.categoryName && row.name === product.name),
  );
  const dupCategories = Number(duplicateCategoryNames[0]?.n ?? 0);
  const dupProducts = Number(duplicatePairs[0]?.n ?? 0);
  const sequenceUntouched = before.orderSequences === after.orderSequences;
  const settingsUntouched = before.settings === after.settings;
  const movementsCreated = after.inventoryMovements - before.inventoryMovements;
  const ordersCreated = after.orders - before.orders;
  const paymentsCreated = after.payments - before.payments;
  const usersCreated = after.users - before.users;
  const tablesCreated = after.tables - before.tables;

  console.log("Post-import verification:");
  console.log(`  Categories: ${approvedCategoryCount} (expected ${EXPECTED_CATEGORY_COUNT}; database total ${allCategories.length})`);
  console.log(`  Products: ${approvedProducts.length} (expected ${EXPECTED_PRODUCT_COUNT}; database total ${allProducts.length})`);
  console.log(`  New products created: ${counts.created}`);
  console.log(`  Existing products updated: ${counts.updated}`);
  console.log(`  Existing products preserved: ${counts.preserved}`);
  console.log(`  Tracked products: ${trackedCount} (expected ${EXPECTED_TRACKED_PRODUCT_COUNT})`);
  console.log(`  Untracked products: ${untrackedCount} (expected ${EXPECTED_UNTRACKED_PRODUCT_COUNT})`);
  console.log(`  Products with zero opening stock: ${zeroStockCount}`);
  console.log(`  Inventory movements created: ${movementsCreated} (database total ${after.inventoryMovements})`);
  console.log(`  Orders created: ${ordersCreated} (database total ${after.orders})`);
  console.log(`  Payments created: ${paymentsCreated} (database total ${after.payments})`);
  console.log(`  Users created: ${usersCreated} (database total ${after.users})`);
  console.log(`  Tables created: ${tablesCreated} (database total ${after.tables})`);
  console.log(`  Duplicate category names: ${dupCategories}`);
  console.log(`  Duplicate (category, product name) pairs: ${dupProducts}`);
  console.log(`  Products outside approved categories: ${productsOutsideApproved}`);
  console.log(`  Products with negative stock: ${negativeStockCount}`);
  console.log(`  OrderSequence untouched: ${sequenceUntouched ? "yes" : "NO"}`);
  console.log(`  Settings untouched: ${settingsUntouched ? "yes" : "NO"}`);

  const failures: string[] = [];
  if (approvedCategoryCount !== EXPECTED_CATEGORY_COUNT) {
    failures.push(`Expected ${EXPECTED_CATEGORY_COUNT} approved categories, found ${approvedCategoryCount}.`);
  }
  if (approvedProducts.length !== EXPECTED_PRODUCT_COUNT) {
    failures.push(`Expected ${EXPECTED_PRODUCT_COUNT} approved products, found ${approvedProducts.length}.`);
  }
  if (missingApproved.length > 0) {
    failures.push(`Missing ${missingApproved.length} approved product(s).`);
  }
  if (trackedCount !== EXPECTED_TRACKED_PRODUCT_COUNT) {
    failures.push(`Expected ${EXPECTED_TRACKED_PRODUCT_COUNT} tracked products, found ${trackedCount}.`);
  }
  if (untrackedCount !== EXPECTED_UNTRACKED_PRODUCT_COUNT) {
    failures.push(`Expected ${EXPECTED_UNTRACKED_PRODUCT_COUNT} untracked products, found ${untrackedCount}.`);
  }
  if (dupCategories !== 0) failures.push("Duplicate category names found.");
  if (dupProducts !== 0) failures.push("Duplicate (category, product name) combinations found.");
  if (negativeStockCount !== 0) failures.push("A product has negative stock.");
  if (movementsCreated !== 0) failures.push("The importer created InventoryMovement rows.");
  if (ordersCreated !== 0) failures.push("The importer created orders.");
  if (paymentsCreated !== 0) failures.push("The importer created payments.");
  if (usersCreated !== 0) failures.push("The importer created users.");
  if (tablesCreated !== 0) failures.push("The importer created tables.");
  if (!sequenceUntouched) failures.push("OrderSequence was modified.");
  if (!settingsUntouched) failures.push("Settings were modified.");

  if (failures.length > 0) {
    throw new Error(`Catalog verification failed:\n- ${failures.join("\n- ")}`);
  }
}

async function main() {
  printBanner();
  assertCatalogIntegrity();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const meta = safeConnectionMeta(databaseUrl);
  assertNotBlockedTarget(databaseUrl, meta);
  printConnectionMeta(meta);

  const dryRun = isDryRun();
  if (!dryRun && !isConfirmed()) {
    console.error("Catalog import not authorized. Set PRODUCTION_CATALOG_IMPORT_CONFIRM=YES to continue.");
    process.exit(1);
  }

  await assertNotLegacySchema();
  const before = await snapshotProtectedState();

  const catalogProducts = flattenCatalogProducts();
  console.log("Catalog source:");
  console.log(`  Categories: ${CATALOG_CATEGORIES.length}`);
  console.log(`  Products: ${catalogProducts.length}`);
  console.log(`  Tracked (approved): ${EXPECTED_TRACKED_PRODUCT_COUNT}`);
  console.log(`  Untracked (approved): ${EXPECTED_UNTRACKED_PRODUCT_COUNT}`);
  console.log(`  Development opening stock will NOT be imported.`);
  console.log("");

  if (dryRun) {
    console.log("DRY-RUN MODE — zero writes will be performed.");
    const plan = await planCatalogChanges();
    console.log(`  Categories that would be created: ${plan.categoriesWouldCreate}`);
    console.log(`  Categories that would be updated: ${plan.categoriesWouldUpdate}`);
    console.log(`  Products that would be created (stockQuantity = 0): ${plan.productsWouldCreate}`);
    console.log(`  Products that would be updated (stock preserved): ${plan.productsWouldUpdate}`);
    const after = await snapshotProtectedState();
    if (
      before.orderSequences !== after.orderSequences ||
      before.settings !== after.settings ||
      before.inventoryMovements !== after.inventoryMovements ||
      before.orders !== after.orders ||
      before.payments !== after.payments ||
      before.users !== after.users ||
      before.tables !== after.tables
    ) {
      throw new Error("Dry-run unexpectedly changed protected database state.");
    }
    console.log("Dry-run complete. No database writes were made.");
    return;
  }

  console.log("CONFIRMED write mode. Importing catalog in a single transaction...");
  const counts = await prisma.$transaction((tx) => importCatalog(tx), {
    maxWait: 15_000,
    timeout: 120_000,
  });

  await verifyAfterImport(counts, before);
  console.log("");
  console.log("Catalog import complete.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
