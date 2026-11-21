import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BUSINESS_NAME = 'Genuine Liquor Store';
const SKU = 'PH24-QA-EXPIRY-001';
const PRODUCT_NAME = 'PH24 QA Expiry Watch Check';
const DESCRIPTION =
  'Synthetic Phase 24 expiry-report fixture; six dated batches across active locations; do not use for sales.';
const BATCHES = [
  { suffix: 'EXPIRED', days: -1 },
  { suffix: 'TODAY', days: 0 },
  { suffix: 'DAYS-007', days: 7 },
  { suffix: 'DAYS-030', days: 30 },
  { suffix: 'DAYS-090', days: 90 },
  { suffix: 'DAYS-091', days: 91 },
] as const;
const QUANTITY_PER_BATCH = 6;
const UNIT_COST = 1000;

function assertSafeTarget() {
  const raw = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== 'development' || !raw)
    throw new Error('Refusing to seed expiry QA data outside local development.');
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || database !== 'genuine')
    throw new Error('Refusing to seed: expected local development database genuine.');
}

function addCalendarDays(date: Date, days: number) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function printCurrentState(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      defaultUnit: { select: { symbol: true } },
      stocks: {
        include: { location: { select: { name: true, code: true } } },
        orderBy: { locationId: 'asc' },
      },
    },
  });
  if (
    !product ||
    product.sku !== SKU ||
    product.name !== PRODUCT_NAME ||
    product.description !== DESCRIPTION
  )
    throw new Error(
      'Existing SKU does not match the isolated Phase 24 expiry fixture; refusing to touch it.',
    );
  const movements = await prisma.inventoryMovement.findMany({
    where: { businessId: product.businessId, productId, referenceType: 'Phase24ExpiryFixture' },
    orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      type: true,
      quantity: true,
      unitCost: true,
      batchNumber: true,
      expiryDate: true,
      location: { select: { name: true, code: true } },
    },
  });
  const ledgerNet = movements.reduce((sum, movement) => sum + movement.quantity, 0);
  const balanceTotal = product.stocks.reduce((sum, balance) => sum + balance.quantity, 0);
  const result = {
    sku: product.sku,
    product: product.name,
    requiresExpiry: product.requiresExpiry,
    unit: product.defaultUnit?.symbol ?? 'UNIT',
    ledgerNet,
    balanceTotal,
    balanced: Math.abs(ledgerNet - balanceTotal) < 0.0001,
    movements: movements.map((movement) => ({
      ...movement,
      expiryDate: movement.expiryDate?.toISOString().slice(0, 10) ?? null,
    })),
    balances: product.stocks.map((balance) => ({
      location: balance.location.name,
      code: balance.location.code,
      quantity: balance.quantity,
    })),
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.balanced || !product.requiresExpiry || movements.length !== BATCHES.length)
    throw new Error(
      'Existing expiry fixture does not match the expected six-batch ledger; inspect before UI testing.',
    );
}

async function main() {
  assertSafeTarget();
  const business = await prisma.business.findUnique({
    where: { name: BUSINESS_NAME },
    select: { id: true, name: true },
  });
  if (!business) throw new Error('Genuine Liquor Store was not found; no data was created.');

  const existing = await prisma.product.findUnique({
    where: { businessId_sku: { businessId: business.id, sku: SKU } },
    select: { id: true, name: true, description: true },
  });
  if (existing) {
    if (existing.name !== PRODUCT_NAME || existing.description !== DESCRIPTION)
      throw new Error(`SKU ${SKU} belongs to a different record; refusing to modify it.`);
    console.log('Expiry fixture already exists; it was not reset or overwritten.');
    await printCurrentState(existing.id);
    return;
  }

  const [owner, referenceProduct, main, branch, locations, settings] = await Promise.all([
    prisma.user.findFirst({
      where: {
        businessId: business.id,
        isActive: true,
        userRoles: { some: { role: { isSystem: true, name: 'Owner' } } },
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.product.findFirst({
      where: { businessId: business.id, sku: 'PH24-QA-TRANSFER-001', status: 'ACTIVE' },
      select: { categoryId: true, defaultUnitId: true, defaultUnit: { select: { symbol: true } } },
    }),
    prisma.location.findFirst({
      where: { businessId: business.id, code: 'MAIN', isActive: true },
      select: { id: true, name: true, code: true },
    }),
    prisma.location.findFirst({
      where: { businessId: business.id, name: 'PH21 Test Branch', isActive: true },
      select: { id: true, name: true, code: true },
    }),
    prisma.location.findMany({
      where: { businessId: business.id, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    prisma.businessSettings.findUnique({
      where: { businessId: business.id },
      select: { lowStockThreshold: true },
    }),
  ]);
  if (
    !owner ||
    !referenceProduct?.categoryId ||
    !referenceProduct.defaultUnitId ||
    !main ||
    !branch ||
    main.id === branch.id
  )
    throw new Error(
      'Required active owner, PH24 category/base unit, Main Warehouse, or PH21 Test Branch missing; no data was created.',
    );
  if (locations.length !== BATCHES.length)
    throw new Error(
      `Expected exactly ${BATCHES.length} active locations for a no-zero-stock fixture, found ${locations.length}; no data was created.`,
    );
  if ((settings?.lowStockThreshold ?? 0) >= QUANTITY_PER_BATCH)
    throw new Error(
      `Business low-stock threshold is ${settings?.lowStockThreshold}; fixture quantity must be raised before seeding to avoid adding low-stock rows.`,
    );

  const orderedLocations = [
    main,
    branch,
    ...locations.filter((location) => location.id !== main.id && location.id !== branch.id),
  ];
  if (orderedLocations.length !== BATCHES.length)
    throw new Error('Active location set changed during fixture preparation; no data was created.');

  const today = new Date();
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        businessId: business.id,
        sku: SKU,
        name: PRODUCT_NAME,
        description: DESCRIPTION,
        categoryId: referenceProduct.categoryId,
        buyingPrice: UNIT_COST,
        sellingPrice: 1500,
        minimumStock: 0,
        reorderLevel: 0,
        defaultUnitId: referenceProduct.defaultUnitId,
        status: 'ACTIVE',
        requiresExpiry: true,
      },
    });

    for (const [index, batch] of BATCHES.entries()) {
      const location = orderedLocations[index];
      const batchNumber = `PH24-EXP-${batch.suffix}-001`;
      const expiryDate = addCalendarDays(today, batch.days);
      const receivedAt = addCalendarDays(expiryDate, -30);
      await tx.stockBalance.create({
        data: {
          productId: created.id,
          locationId: location.id,
          quantity: QUANTITY_PER_BATCH,
          lastMovementAt: receivedAt,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          businessId: business.id,
          productId: created.id,
          locationId: location.id,
          type: 'PURCHASE',
          quantity: QUANTITY_PER_BATCH,
          referenceId: `PH24-QA-EXPIRY-${batch.suffix}`,
          referenceType: 'Phase24ExpiryFixture',
          notes: `Synthetic expiry-report QA batch ${batchNumber}; ${batch.days} calendar days from fixture creation.`,
          unitCost: UNIT_COST,
          batchNumber,
          expiryDate,
          createdAt: receivedAt,
          createdBy: owner.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        businessId: business.id,
        userId: owner.id,
        actorName: `${owner.firstName} ${owner.lastName}`,
        actorEmail: owner.email,
        action: 'CREATE_QA_FIXTURE',
        entityType: 'Product',
        entityId: created.id,
        description: `Created six synthetic tracked expiry batches for ${SKU}; aggregate quantity ${BATCHES.length * QUANTITY_PER_BATCH} ${referenceProduct.defaultUnit?.symbol ?? 'UNIT'}.`,
      },
    });
    return created;
  });

  console.log(
    'Created a synthetic expiry fixture in six active locations. No existing product or movement was modified.',
  );
  await printCurrentState(product.id);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Phase 24 expiry fixture failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
