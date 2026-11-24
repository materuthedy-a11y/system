import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BUSINESS_NAME = 'Genuine Liquor Store';
const FIXTURE_SKU = 'PH24-QA-LOW-STOCK-DIFF-001';
const FIXTURE_NAME = 'PH24 QA Low Stock Threshold Check';
const FIXTURE_DESCRIPTION =
  'PH24 QA low-stock threshold fixture. Synthetic test data; no real customer or supplier.';
const ADJUSTMENT_NUMBER = 'PH24-QA-LOWSTOCK-MAIN-001';

function assertSafeTarget() {
  const raw = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== 'development' || !raw) {
    throw new Error('Refusing to seed: requires NODE_ENV=development and DATABASE_URL.');
  }
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || database !== 'genuine') {
    throw new Error(
      'Refusing to seed: fixtures only run against the local development database genuine.',
    );
  }
}

async function reportFixture(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      stocks: { include: { location: { select: { name: true, code: true, isActive: true } } } },
    },
  });
  if (!product) throw new Error('Fixture product disappeared during verification.');
  const settings = await prisma.businessSettings.findUnique({
    where: { businessId: product.businessId },
    select: { lowStockThreshold: true },
  });
  const globalThreshold = Number(settings?.lowStockThreshold ?? 0);
  const minimumStock = Math.max(product.minimumStock, globalThreshold);
  const reorderLevel = Math.max(product.reorderLevel, globalThreshold);
  const rows = product.stocks
    .filter((stock) => stock.location.isActive)
    .map((stock) => ({
      location: stock.location.name,
      onHand: stock.quantity,
      effectiveMinimum: minimumStock,
      effectiveReorder: reorderLevel,
      belowMinimum: stock.quantity < minimumStock,
      atOrBelowReorder: stock.quantity <= reorderLevel,
    }));
  const mainRow = rows.find((row) =>
    product.stocks.some(
      (stock) => stock.location.code === 'MAIN' && stock.location.name === row.location,
    ),
  );
  console.log(
    JSON.stringify({ sku: product.sku, product: product.name, globalThreshold, rows }, null, 2),
  );
  if (!mainRow || mainRow.belowMinimum || !mainRow.atOrBelowReorder) {
    throw new Error('Fixture does not produce the expected reorder-only Main Warehouse case.');
  }
}

async function main() {
  assertSafeTarget();
  const business = await prisma.business.findUnique({ where: { name: BUSINESS_NAME } });
  const owner = business
    ? await prisma.user.findFirst({
        where: {
          businessId: business.id,
          isActive: true,
          userRoles: { some: { role: { isSystem: true, name: 'Owner' } } },
        },
      })
    : null;
  if (!business || !owner) throw new Error('Seeded QA business owner was not found.');

  const existing = await prisma.product.findUnique({
    where: { businessId_sku: { businessId: business.id, sku: FIXTURE_SKU } },
  });
  if (existing) {
    if (existing.name !== FIXTURE_NAME || existing.description !== FIXTURE_DESCRIPTION) {
      throw new Error(
        `SKU ${FIXTURE_SKU} already belongs to another product; refusing to alter it.`,
      );
    }
    console.log('Fixture already exists; it was not changed. Current state follows.');
    await reportFixture(existing.id);
    return;
  }

  const [referenceProduct, main, settings] = await Promise.all([
    prisma.product.findFirst({
      where: { businessId: business.id, status: 'ACTIVE', defaultUnitId: { not: null } },
      select: { categoryId: true, defaultUnitId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findFirst({ where: { businessId: business.id, code: 'MAIN', isActive: true } }),
    prisma.businessSettings.findUnique({
      where: { businessId: business.id },
      select: { lowStockThreshold: true },
    }),
  ]);
  if (!referenceProduct?.defaultUnitId || !main) {
    throw new Error('An active product unit and Main Warehouse are required; no data was created.');
  }

  const globalThreshold = Number(settings?.lowStockThreshold ?? 0);
  const productMinimum = 10;
  const productReorder = Math.max(20, globalThreshold + 10);
  const effectiveMinimum = Math.max(productMinimum, globalThreshold);
  const effectiveReorder = Math.max(productReorder, globalThreshold);
  const openingQuantity = effectiveMinimum + Math.ceil((effectiveReorder - effectiveMinimum) / 2);
  if (!(openingQuantity > effectiveMinimum && openingQuantity <= effectiveReorder)) {
    throw new Error('Could not build a quantity between the effective thresholds.');
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        businessId: business.id,
        sku: FIXTURE_SKU,
        name: FIXTURE_NAME,
        description: FIXTURE_DESCRIPTION,
        categoryId: referenceProduct.categoryId,
        buyingPrice: 1000,
        sellingPrice: 1500,
        minimumStock: productMinimum,
        reorderLevel: productReorder,
        defaultUnitId: referenceProduct.defaultUnitId,
        status: 'ACTIVE',
      },
    });
    const now = new Date();
    const adjustment = await tx.stockAdjustment.create({
      data: {
        businessId: business.id,
        adjustmentNumber: ADJUSTMENT_NUMBER,
        adjustmentDate: now,
        reason: 'PH24 QA low-stock threshold fixture',
        status: 'APPROVED',
        createdBy: owner.id,
        approvedBy: owner.id,
        approvedAt: now,
        notes: 'Synthetic test opening quantity; use only to verify low-stock threshold filters.',
        items: {
          create: [
            {
              productId: created.id,
              currentQty: 0,
              adjustedQty: openingQuantity,
              difference: openingQuantity,
              locationId: main.id,
              reason: 'PH24 QA opening balance fixture',
            },
          ],
        },
      },
    });
    await tx.stockBalance.create({
      data: {
        productId: created.id,
        locationId: main.id,
        quantity: openingQuantity,
        lastMovementAt: now,
      },
    });
    await tx.inventoryMovement.create({
      data: {
        businessId: business.id,
        productId: created.id,
        locationId: main.id,
        type: 'ADJUSTMENT',
        quantity: openingQuantity,
        referenceId: adjustment.id,
        referenceType: 'StockAdjustment',
        notes: 'PH24 QA low-stock threshold fixture',
        unitCost: 1000,
        createdBy: owner.id,
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: business.id,
        userId: owner.id,
        actorName: `${owner.firstName} ${owner.lastName}`,
        actorEmail: owner.email,
        action: 'CREATE_QA_FIXTURE',
        entityType: 'Product',
        entityId: created.id,
        description: `Created synthetic low-stock test product ${FIXTURE_SKU}; approved opening adjustment ${ADJUSTMENT_NUMBER} adds ${openingQuantity} units at Main Warehouse.`,
      },
    });
    return created;
  });

  console.log(`Created synthetic QA fixture with ${openingQuantity} units in Main Warehouse.`);
  await reportFixture(product.id);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Phase 24 low-stock fixture failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
