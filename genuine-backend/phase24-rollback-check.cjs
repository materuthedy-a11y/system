require('dotenv/config');
require('ts-node/register/transpile-only');

const { PrismaClient } = require('@prisma/client');
const { InventoryService } = require('./src/inventory/inventory.service');
const prisma = new PrismaClient();

const businessName = 'Genuine Liquor Store';
const creatorId = 'ced9c641-8d09-476e-a1f5-012f6ff9fc8b';
const approverId = 'cmw0vhsgl0026rphwew6i46iz';
const firstSku = 'PH24-QA-TRANSFER-001';
const secondSku = 'PH24-QA-LOW-STOCK-DIFF-001';

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/genuine') {
    throw new Error('Refusing to run outside the guarded local genuine development database');
  }

  const business = await prisma.business.findUnique({
    where: { name: businessName },
    select: { id: true, allowNegativeStock: true },
  });
  if (!business || business.allowNegativeStock) {
    throw new Error('Expected local business with negative stock disabled');
  }

  const [creator, approver, mainLocation, ph19Location, firstProduct, secondProduct] =
    await Promise.all([
      prisma.user.findFirst({
        where: { id: creatorId, businessId: business.id, isActive: true },
      }),
      prisma.user.findFirst({
        where: { id: approverId, businessId: business.id, isActive: true },
      }),
      prisma.location.findFirst({
        where: { businessId: business.id, code: 'MAIN', isActive: true },
      }),
      prisma.location.findFirst({
        where: { businessId: business.id, code: 'PH19-WH-01', isActive: true },
      }),
      prisma.product.findFirst({
        where: { businessId: business.id, sku: firstSku, status: 'ACTIVE' },
      }),
      prisma.product.findFirst({
        where: { businessId: business.id, sku: secondSku, status: 'ACTIVE' },
      }),
    ]);

  if (
    !creator ||
    !approver ||
    creator.id === approver.id ||
    !mainLocation ||
    !ph19Location ||
    !firstProduct ||
    !secondProduct
  ) {
    throw new Error('Required active QA actors, products, or locations were not found');
  }

  async function snapshot() {
    const [first, second, firstMovements, secondMovements] = await Promise.all([
      prisma.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: firstProduct.id,
            locationId: mainLocation.id,
          },
        },
        select: { quantity: true },
      }),
      prisma.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: secondProduct.id,
            locationId: ph19Location.id,
          },
        },
        select: { quantity: true },
      }),
      prisma.inventoryMovement.count({
        where: { businessId: business.id, productId: firstProduct.id },
      }),
      prisma.inventoryMovement.count({
        where: { businessId: business.id, productId: secondProduct.id },
      }),
    ]);
    return {
      firstQuantity: first?.quantity ?? 0,
      secondQuantity: second?.quantity ?? 0,
      firstMovements,
      secondMovements,
    };
  }

  const baseline = await snapshot();
  if (
    baseline.firstQuantity !== 6 ||
    baseline.secondQuantity !== 0 ||
    firstProduct.id.localeCompare(secondProduct.id) >= 0
  ) {
    throw new Error('QA rollback preconditions changed; refusing to run');
  }

  const service = new InventoryService(prisma, { checkStockLevel: async () => undefined });
  const adjustment = await service.createStockAdjustment(business.id, creator.id, {
    notes: 'PH24 QA multi-line transaction rollback check',
    items: [
      {
        productId: firstProduct.id,
        locationId: mainLocation.id,
        quantity: 1,
        reason: 'PH24_QA_ROLLBACK',
        notes: 'First line should be rolled back',
      },
      {
        productId: secondProduct.id,
        locationId: ph19Location.id,
        quantity: -1,
        reason: 'PH24_QA_ROLLBACK',
        notes: 'Second line intentionally exceeds zero stock',
      },
    ],
  });

  let approvalError = null;
  try {
    await service.approveStockAdjustment(business.id, adjustment.id, approver.id);
  } catch (error) {
    approvalError = error.message;
  }

  const afterFailure = await snapshot();
  const failedApprovalMovements = await prisma.inventoryMovement.count({
    where: {
      businessId: business.id,
      referenceId: adjustment.id,
      referenceType: 'StockAdjustment',
    },
  });
  const pending = await prisma.stockAdjustment.findFirst({
    where: { id: adjustment.id, businessId: business.id },
    select: { status: true },
  });
  const rollbackPassed =
    approvalError ===
      `Adjustment would make ${secondProduct.name} stock negative` &&
    JSON.stringify(baseline) === JSON.stringify(afterFailure) &&
    failedApprovalMovements === 0 &&
    pending?.status === 'PENDING';

  if (pending?.status === 'PENDING') {
    await service.rejectStockAdjustment(
      business.id,
      adjustment.id,
      approver.id,
      'PH24 QA rollback scenario cleanup',
    );
  }

  const [finalSnapshot, finalAdjustment, audit, finalMovements] = await Promise.all([
    snapshot(),
    prisma.stockAdjustment.findUnique({
      where: { id: adjustment.id },
      select: { status: true, adjustmentNumber: true },
    }),
    prisma.auditLog.findMany({
      where: {
        businessId: business.id,
        entityType: 'StockAdjustment',
        entityId: adjustment.id,
      },
      select: { action: true, actorName: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.inventoryMovement.count({
      where: {
        businessId: business.id,
        referenceId: adjustment.id,
        referenceType: 'StockAdjustment',
      },
    }),
  ]);
  const cleanupPassed =
    finalAdjustment?.status === 'REJECTED' &&
    JSON.stringify(baseline) === JSON.stringify(finalSnapshot) &&
    finalMovements === 0 &&
    audit.map((entry) => entry.action).join(',') === 'CREATE,REJECT';

  console.log(
    JSON.stringify(
      {
        result: rollbackPassed && cleanupPassed ? 'PASS' : 'FAIL',
        adjustmentNumber: finalAdjustment?.adjustmentNumber,
        approvalError,
        baseline,
        afterRejected: finalSnapshot,
        movementReferences: finalMovements,
        audit: audit.map((entry) => ({
          action: entry.action,
          actorName: entry.actorName,
        })),
        status: finalAdjustment?.status,
      },
      null,
      2,
    ),
  );
  if (!rollbackPassed || !cleanupPassed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
