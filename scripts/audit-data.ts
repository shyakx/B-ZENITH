import { prisma } from '../src/lib/prisma';

async function run() {
  try {
    console.log('--- MASTER DATA COUNTS ---');
    const masterCounts = {
      User: await prisma.user.count(),
      Product: await prisma.product.count(),
      Category: await prisma.category.count(),
      InventoryLocation: await prisma.inventoryLocation.count(),
      Supplier: await prisma.supplier.count(),
      Purchase: await prisma.purchase.count(),
    };
    console.log(JSON.stringify(masterCounts, null, 2));

    console.log('\n--- TRANSACTIONAL RECORD COUNTS ---');
    const transCounts = {
      Sale: await prisma.sale.count(),
      SaleItem: await prisma.saleItem.count(),
      Payment: await prisma.payment.count(),
      Return: await prisma.return.count(),
      ReturnItem: await prisma.returnItem.count(),
      BilliardDaySale: await prisma.billiardDaySale.count(),
      AuditLog: await prisma.auditLog.count(),
    };
    console.log(JSON.stringify(transCounts, null, 2));

    console.log('\n--- INVENTORY MOVEMENT COUNTS BY TYPE ---');
    const moveTypes = ['SALE', 'PURCHASE', 'RETURN', 'ADJUSTMENT', 'STOCK_TAKE', 'TRANSFER_OUT', 'TRANSFER_IN', 'WASTE'];
    const moveCounts: Record<string, number> = {};
    for (const type of moveTypes) {
      moveCounts[type] = await prisma.inventoryMovement.count({ where: { type: type as any } });
    }
    console.log(JSON.stringify(moveCounts, null, 2));

    console.log('\n--- INVENTORY RECONCILIATION AUDIT ---');
    const products = await prisma.product.findMany({
      where: { trackInventory: true },
      include: {
        locationStocks: true
      }
    });

    const reconciliation = products.map(p => {
      const locationSum = p.locationStocks.reduce((sum, ls) => sum + ls.quantity, 0);
      const mismatch = p.stockQuantity !== locationSum;
      return {
        sku: p.sku,
        name: p.name,
        cachedStockQuantity: p.stockQuantity,
        locationSum: locationSum,
        mismatch: mismatch
      };
    });

    const mismatches = reconciliation.filter(r => r.mismatch);
    if (mismatches.length > 0) {
      console.log('!!! STOCK MISMATCHES DETECTED !!!');
      console.log(JSON.stringify(mismatches, null, 2));
    } else {
      console.log('No stock mismatches detected. Product.stockQuantity matches SUM(ProductLocationStock).');
    }

    console.log('\n--- TOTAL STOCK QUANTITY ---');
    const totalCached = products.reduce((sum, p) => sum + p.stockQuantity, 0);
    const totalLocation = products.reduce((sum, p) => sum + p.locationStocks.reduce((s, ls) => s + ls.quantity, 0), 0);
    console.log({
      totalCachedProducts: totalCached,
      totalLocationStock: totalLocation
    });

  } catch (e) {
    console.error('DB Error:', e instanceof Error ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
