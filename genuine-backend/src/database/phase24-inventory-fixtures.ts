import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BUSINESS_NAME = 'Genuine Liquor Store';
const FIXTURE_SKU = 'PH24-QA-TRANSFER-001';
const FIXTURE_NAME = 'PH24 QA Transfer Reconciliation';
const FIXTURE_DESCRIPTION =
  'PH24 QA synthetic inventory reconciliation fixture; no real customer or supplier.';

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
      defaultUnit: { select: { name: true, symbol: true } },
      stocks: { include: { location: { select: { name: true, code: true } } } },
    },
  });
  if (!product) throw new Error('Fixture product disappeared during verification.');
  const [movements, adjustments] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
      select: {
        type: true,
        quantity: true,
        referenceType: true,
        referenceId: true,
        location: { select: { code: true } },
      },
    }),
    prisma.stockAdjustment.findMany({
      where: { businessId: product?.businessId, adjustmentNumber: { startsWith: 'PH24-QA-OPEN-' } },
      include: { items: { where: { productId }, select: { difference: true, locationId: true } } },
      orderBy: { adjustmentNumber: 'asc' },
    }),
  ]);
  const movementNet = movements.reduce((sum, movement) => sum + movement.quantity, 0);
  const balanceTotal = product?.stocks.reduce((sum, balance) => sum + balance.quantity, 0) ?? 0;
  const report = {
    sku: product?.sku,
    product: product?.name,
    baseUnit: product?.defaultUnit?.symbol ?? 'UNIT',
    balances:
      product?.stocks.map((balance) => ({
        location: balance.location.code,
        quantity: balance.quantity,
      })) ?? [],
    fixtureOpeningAdjustments: adjustments.map((adjustment) => ({
      adjustmentNumber: adjustment.adjustmentNumber,
      status: adjustment.status,
      lines: adjustment.items.map((item) => ({
        locationId: item.locationId,
        quantity: item.difference,
      })),
    })),
    movementCount: movements.length,
    movementNet,
    balanceTotal,
    balanced: Math.abs(movementNet - balanceTotal) < 0.0001,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.balanced)
    throw new Error('Fixture ledger does not reconcile; stop and inspect before UI testing.');
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
  if (!business || !owner) {
    throw new Error('Seeded QA business owner was not found; no fixture was created.');
  }

  const existing = await prisma.product.findUnique({
    where: { businessId_sku: { businessId: business.id, sku: FIXTURE_SKU } },
  });
  if (existing) {
    if (existing.name !== FIXTURE_NAME || existing.description !== FIXTURE_DESCRIPTION) {
      throw new Error(
        `SKU ${FIXTURE_SKU} already belongs to a different product; refusing to alter it.`,
      );
    }
    console.log(
      'Fixture already exists; it was not reset or overwritten. Current ledger snapshot follows.',
    );
    await reportFixture(existing.id);
    return;
  }

  const [referenceProduct, main, branch] = await Promise.all([
    prisma.product.findFirst({
      where: { businessId: business.id, sku: 'PH25-QA-UNIT-001', status: 'ACTIVE' },
      select: { categoryId: true, defaultUnitId: true },
    }),
    prisma.location.findFirst({ where: { businessId: business.id, code: 'MAIN', isActive: true } }),
    prisma.location.findFirst({
      where: { businessId: business.id, code: 'PH21-BR-01', isActive: true },
    }),
  ]);
  if (!referenceProduct?.defaultUnitId || !main || !branch || main.id === branch.id) {
    throw new Error(
      'Expected active PH25 base-unit product plus MAIN and PH21-BR-01 locations; no fixture was created.',
    );
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
        minimumStock: 2,
        reorderLevel: 4,
        defaultUnitId: referenceProduct.defaultUnitId,
        status: 'ACTIVE',
      },
    });
    const openings = [
      { location: main, quantity: 10, suffix: 'MAIN' },
      { location: branch, quantity: 2, suffix: 'BRANCH' },
    ];
    for (const opening of openings) {
      const now = new Date();
      const adjustmentNumber = `PH24-QA-OPEN-${opening.suffix}-001`;
      const adjustment = await tx.stockAdjustment.create({
        data: {
          businessId: business.id,
          adjustmentNumber,
          adjustmentDate: now,
          reason: 'PH24 QA opening balance fixture',
          status: 'APPROVED',
          createdBy: owner.id,
          approvedBy: owner.id,
          approvedAt: now,
          notes: 'Synthetic QA opening quantity; reconciled to one ADJUSTMENT movement.',
          items: {
            create: [
              {
                productId: created.id,
                currentQty: 0,
                adjustedQty: opening.quantity,
                difference: opening.quantity,
                locationId: opening.location.id,
                reason: 'PH24 QA opening balance fixture',
              },
            ],
          },
        },
      });
      await tx.stockBalance.create({
        data: {
          productId: created.id,
          locationId: opening.location.id,
          quantity: opening.quantity,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          businessId: business.id,
          productId: created.id,
          locationId: opening.location.id,
          type: 'ADJUSTMENT',
          quantity: opening.quantity,
          referenceId: adjustment.id,
          referenceType: 'StockAdjustment',
          notes: 'PH24 QA opening balance fixture',
          unitCost: created.buyingPrice,
          createdBy: owner.id,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId: business.id,
          userId: owner.id,
          actorName: `${owner.firstName} ${owner.lastName}`,
          actorEmail: owner.email,
          action: 'CREATE_AND_APPROVE_QA_FIXTURE',
          entityType: 'StockAdjustment',
          entityId: adjustment.id,
          description: `PH24 synthetic opening balance ${adjustmentNumber}: +${opening.quantity} ${FIXTURE_SKU} at ${opening.location.code}`,
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
        description: `Created synthetic Phase 24 inventory test product ${FIXTURE_SKU}`,
      },
    });
    return created;
  });

  console.log(
    'Created a synthetic Phase 24 fixture. No existing product or historical movement was changed.',
  );
  await reportFixture(product.id);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Phase 24 inventory fixture failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
