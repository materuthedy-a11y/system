import { InventoryService } from './inventory.service';
import { PrismaService } from '../database/prisma.service';

function createPrismaMock() {
  const prisma: any = {
    user: { findFirst: jest.fn() },
    stockBalance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    product: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    inventoryMovement: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
    },
    stockAdjustment: {
      count: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    stockTransfer: { count: jest.fn() },
    physicalCount: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    business: { findUnique: jest.fn() },
    businessSettings: { findUnique: jest.fn() },
    location: { findMany: jest.fn(), findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((callback: (tx: any) => unknown) => callback(prisma));
  return prisma;
}

describe('InventoryService location scope and thresholds', () => {
  it('updates reorder thresholds and records the exact before/after audit values', async () => {
    const prisma = createPrismaMock();
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-a',
      businessId: 'business-a',
      status: 'ACTIVE',
      name: 'QA product',
      sku: 'QA-1',
      minimumStock: 4,
      reorderLevel: 4,
      buyingPrice: 100,
    });
    prisma.product.update.mockResolvedValue({
      id: 'product-a',
      name: 'QA product',
      sku: 'QA-1',
      minimumStock: 4,
      reorderLevel: 12,
      buyingPrice: 100,
    });

    const service = new InventoryService(prisma as PrismaService, {} as never);
    const result = await service.updateReorderPoint('business-a', 'owner-a', 'product-a', {
      minimumStock: 4,
      reorderLevel: 12,
    });

    expect(result).toEqual(expect.objectContaining({ minimumStock: 4, reorderLevel: 12 }));
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-a' },
        data: { minimumStock: 4, reorderLevel: 12 },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: 'business-a',
        userId: 'owner-a',
        action: 'UPDATE_REORDER_POINTS',
        entityId: 'product-a',
        beforeData: JSON.stringify({ minimumStock: 4, reorderLevel: 4 }),
        afterData: JSON.stringify({ minimumStock: 4, reorderLevel: 12 }),
      }),
    });
  });

  it('treats saving unchanged reorder thresholds as an idempotent no-op without audit noise', async () => {
    const prisma = createPrismaMock();
    const existing = {
      id: 'product-a',
      businessId: 'business-a',
      status: 'ACTIVE',
      name: 'QA product',
      sku: 'QA-1',
      minimumStock: 4,
      reorderLevel: 12,
      buyingPrice: 100,
    };
    prisma.product.findFirst.mockResolvedValue(existing);

    const service = new InventoryService(prisma as PrismaService, {} as never);
    const result = await service.updateReorderPoint('business-a', 'owner-a', 'product-a', {
      minimumStock: 4,
      reorderLevel: 12,
    });

    expect(result).toEqual(expect.objectContaining({ minimumStock: 4, reorderLevel: 12 }));
    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects minimum stock above reorder level without changing the product or audit log', async () => {
    const prisma = createPrismaMock();
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-a',
      businessId: 'business-a',
      status: 'ACTIVE',
      minimumStock: 4,
      reorderLevel: 12,
    });

    const service = new InventoryService(prisma as PrismaService, {} as never);
    await expect(
      service.updateReorderPoint('business-a', 'owner-a', 'product-a', {
        minimumStock: 13,
        reorderLevel: 12,
      }),
    ).rejects.toThrow('Minimum stock cannot exceed reorder level');
    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('distinguishes saved balance rows from low-stock product/location pairs with implicit zero stock', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      userRoles: [{ role: { name: 'Owner', isSystem: true } }],
      assignedLocations: [],
    });
    prisma.stockBalance.findMany.mockResolvedValue([
      {
        productId: 'product-a',
        locationId: 'location-a',
        quantity: 5,
        product: { defaultUnit: { symbol: 'PCS' } },
      },
      {
        productId: 'product-a',
        locationId: 'location-b',
        quantity: 0,
        product: { defaultUnit: { symbol: 'PCS' } },
      },
      {
        productId: 'product-b',
        locationId: 'location-b',
        quantity: 3,
        product: { defaultUnit: { symbol: 'BOX' } },
      },
    ]);
    prisma.product.findMany.mockResolvedValue([
      { id: 'product-a', minimumStock: 2, reorderLevel: 5, defaultUnit: { symbol: 'PCS' } },
      { id: 'product-b', minimumStock: 1, reorderLevel: 2, defaultUnit: { symbol: 'BOX' } },
    ]);
    prisma.inventoryMovement.findMany.mockResolvedValue([]);
    prisma.stockAdjustment.count.mockResolvedValue(0);
    prisma.stockTransfer.count.mockResolvedValue(0);
    prisma.physicalCount.count.mockResolvedValue(0);
    prisma.businessSettings.findUnique.mockResolvedValue({ lowStockThreshold: 0 });
    prisma.location.findMany.mockResolvedValue([{ id: 'location-a' }, { id: 'location-b' }]);

    const service = new InventoryService(prisma as PrismaService, {} as never);
    jest.spyOn(service, 'getStockValuationReport').mockResolvedValue({ totalValue: 800 } as never);
    jest.spyOn(service, 'getStockExpiryReport').mockResolvedValue({ total: 0 } as never);

    const result = await service.getInventoryDashboard('business-a', 'owner-a');

    // There are two materialized StockBalance rows, but three of four product/location
    // pairs are at/below reorder once missing balances are correctly treated as zero.
    expect(result.stockQuantitiesByUnit).toEqual([
      { unit: 'BOX', quantity: 3 },
      { unit: 'PCS', quantity: 5 },
    ]);
    expect(result.lowStockProductLocationPairs).toBe(3);
    expect(result).not.toHaveProperty('totalStockUnits');
    expect(result).not.toHaveProperty('totalStockQuantity');
    expect(result).not.toHaveProperty('lowStockBalances');
  });

  it('limits inventory dashboard totals, alerts and queues to assigned locations', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      userRoles: [{ role: { name: 'Staff', isSystem: false } }],
      assignedLocations: [{ id: 'location-a' }],
    });
    prisma.stockBalance.findMany.mockResolvedValue([]);
    prisma.product.findMany.mockResolvedValue([]);
    prisma.inventoryMovement.findMany.mockResolvedValue([]);
    prisma.stockAdjustment.count.mockResolvedValue(0);
    prisma.stockTransfer.count.mockResolvedValue(0);
    prisma.physicalCount.count.mockResolvedValue(0);
    prisma.businessSettings.findUnique.mockResolvedValue({ lowStockThreshold: 0 });
    prisma.location.findMany.mockResolvedValue([{ id: 'location-a' }]);

    const service = new InventoryService(prisma as PrismaService, {} as never);
    jest.spyOn(service, 'getStockValuationReport').mockResolvedValue({ totalValue: 0 } as never);
    jest.spyOn(service, 'getStockExpiryReport').mockResolvedValue({ total: 0 } as never);

    await service.getInventoryDashboard('business-a', 'staff-a');

    expect(prisma.stockBalance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          product: { businessId: 'business-a' },
          location: { businessId: 'business-a', id: { in: ['location-a'] } },
        },
      }),
    );
    expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          location: { businessId: 'business-a', id: { in: ['location-a'] } },
        }),
      }),
    );
    expect(prisma.stockAdjustment.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          items: {
            some: { locationId: { in: ['location-a'] } },
            every: { locationId: { in: ['location-a'] } },
          },
        }),
      }),
    );
    expect(prisma.stockTransfer.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fromLocationId: { in: ['location-a'] },
          toLocationId: { in: ['location-a'] },
        }),
      }),
    );
    expect(prisma.physicalCount.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ location: { id: { in: ['location-a'] } } }),
      }),
    );
    expect(service.getStockValuationReport).toHaveBeenCalledWith(
      'business-a',
      'staff-a',
      expect.any(Object),
    );
  });

  it('treats stock exactly at minimum as not below minimum but still at or below reorder', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      userRoles: [{ role: { name: 'Staff', isSystem: false } }],
      assignedLocations: [{ id: 'location-a' }],
    });
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-a',
        name: 'Product A',
        sku: 'A',
        minimumStock: 5,
        reorderLevel: 10,
        buyingPrice: 100,
        stocks: [{ locationId: 'location-a', quantity: 5 }],
      },
    ]);
    prisma.location.findMany.mockResolvedValue([{ id: 'location-a', name: 'Location A' }]);
    prisma.businessSettings.findUnique.mockResolvedValue({ lowStockThreshold: 0 });
    prisma.inventoryMovement.groupBy.mockResolvedValue([]);

    const service = new InventoryService(prisma as PrismaService, {} as never);
    const result = await service.getLowStockReport('business-a', 'staff-a', {
      page: 1,
      limit: 20,
    } as never);

    expect(result.data).toEqual([
      expect.objectContaining({
        quantity: 5,
        belowMinimum: false,
        atOrBelowReorderLevel: true,
      }),
    ]);
  });

  it('applies the business threshold to effective limits and keeps minimum strict while reorder is inclusive', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      userRoles: [{ role: { name: 'Owner', isSystem: true } }],
      assignedLocations: [],
    });
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-a',
        name: 'PH24 QA product',
        sku: 'PH24-QA-1',
        minimumStock: 2,
        reorderLevel: 4,
        buyingPrice: 1000,
        stocks: [
          { locationId: 'location-at-threshold', quantity: 5 },
          { locationId: 'location-below-threshold', quantity: 4 },
          { locationId: 'location-above-threshold', quantity: 6 },
        ],
      },
    ]);
    prisma.location.findMany.mockResolvedValue([
      { id: 'location-at-threshold', name: 'At threshold' },
      { id: 'location-below-threshold', name: 'Below threshold' },
      { id: 'location-above-threshold', name: 'Above threshold' },
    ]);
    prisma.businessSettings.findUnique.mockResolvedValue({ lowStockThreshold: 5 });
    prisma.inventoryMovement.groupBy.mockResolvedValue([]);

    const service = new InventoryService(prisma as PrismaService, {} as never);
    const reorder = await service.getLowStockReport('business-a', 'owner-a', {
      page: 1,
      limit: 20,
      type: 'REORDER',
    } as never);
    const belowMinimum = await service.getLowStockReport('business-a', 'owner-a', {
      page: 1,
      limit: 20,
      type: 'BELOW_MINIMUM',
    } as never);

    expect(reorder.data).toEqual([
      expect.objectContaining({
        locationName: 'At threshold',
        quantity: 5,
        minimumStock: 5,
        reorderLevel: 5,
        belowMinimum: false,
        atOrBelowReorderLevel: true,
      }),
      expect.objectContaining({
        locationName: 'Below threshold',
        quantity: 4,
        minimumStock: 5,
        reorderLevel: 5,
        belowMinimum: true,
        atOrBelowReorderLevel: true,
      }),
    ]);
    expect(reorder.total).toBe(2);
    expect(belowMinimum.data).toEqual([
      expect.objectContaining({
        locationName: 'Below threshold',
        quantity: 4,
        minimumStock: 5,
        reorderLevel: 5,
        belowMinimum: true,
        atOrBelowReorderLevel: true,
      }),
    ]);
    expect(belowMinimum.total).toBe(1);
  });
});

describe('InventoryService expiry reports', () => {
  const expiryBatches = [
    ['expired-yesterday', '2026-11-19'],
    ['expires-today', '2026-11-20'],
    ['expires-in-7-days', '2026-11-27'],
    ['expires-in-30-days', '2026-12-20'],
    ['expires-in-90-days', '2027-02-18'],
    ['expires-in-91-days', '2027-02-19'],
  ].map(([batchNumber, expiryDate]) => ({
    id: `movement-${batchNumber}`,
    businessId: 'business-a',
    productId: 'product-a',
    locationId: 'location-a',
    type: 'PURCHASE',
    quantity: 1,
    unitCost: 100,
    batchNumber,
    expiryDate: new Date(`${expiryDate}T00:00:00.000Z`),
    createdAt: new Date('2026-11-01T12:00:00.000Z'),
    product: { id: 'product-a', name: 'Expiry QA product', sku: 'EXP-QA-1', buyingPrice: 100 },
    location: { id: 'location-a', name: 'Main Warehouse' },
  }));

  function setup() {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      userRoles: [{ role: { name: 'Owner', isSystem: true } }],
      assignedLocations: [],
    });
    prisma.location.findMany.mockResolvedValue([{ id: 'location-a', name: 'Main Warehouse' }]);
    prisma.inventoryMovement.findMany.mockResolvedValue(expiryBatches);
    prisma.stockBalance.findMany.mockResolvedValue([
      {
        productId: 'product-a',
        locationId: 'location-a',
        quantity: expiryBatches.length,
        product: { defaultUnit: { symbol: 'btl' } },
      },
    ]);
    return prisma;
  }

  it('treats expiry dates as calendar days and applies inclusive 7/30/90-day windows', async () => {
    const prisma = setup();
    const service = new InventoryService(prisma as PrismaService, {} as never);
    const base = { page: 1, limit: 20, asOfDate: '2026-11-20T12:00:00.000Z' };

    const all = await service.getStockExpiryReport('business-a', 'owner-a', {
      ...base,
      status: 'ALL',
    } as never);
    const expired = await service.getStockExpiryReport('business-a', 'owner-a', {
      ...base,
      status: 'EXPIRED',
    } as never);
    const next7 = await service.getStockExpiryReport('business-a', 'owner-a', {
      ...base,
      status: 'EXPIRING_7_DAYS',
    } as never);
    const next30 = await service.getStockExpiryReport('business-a', 'owner-a', {
      ...base,
      status: 'EXPIRING_30_DAYS',
    } as never);
    const next90 = await service.getStockExpiryReport('business-a', 'owner-a', {
      ...base,
      status: 'EXPIRING_90_DAYS',
    } as never);

    expect(all.data).toHaveLength(6);
    expect(all.data.map((row) => row.daysUntilExpiry)).toEqual([-1, 0, 7, 30, 90, 91]);
    expect(all.data[1]).toEqual(
      expect.objectContaining({
        batchNumber: 'expires-today',
        daysUntilExpiry: 0,
        status: 'EXPIRING',
      }),
    );
    expect(expired.data.map((row) => row.batchNumber)).toEqual(['expired-yesterday']);
    expect(next7.data.map((row) => row.batchNumber)).toEqual([
      'expires-today',
      'expires-in-7-days',
    ]);
    expect(next30.data.map((row) => row.batchNumber)).toEqual([
      'expires-today',
      'expires-in-7-days',
      'expires-in-30-days',
    ]);
    expect(next90.data.map((row) => row.batchNumber)).toEqual([
      'expires-today',
      'expires-in-7-days',
      'expires-in-30-days',
      'expires-in-90-days',
    ]);
    expect(all.untrackedExpiryQuantity).toBe(0);
  });

  it('combines movement layers for the same batch, location, and expiry date', async () => {
    const prisma = setup();
    const duplicateBatch = {
      ...expiryBatches[0],
      id: 'movement-expired-yesterday-adjustment',
      quantity: 1,
    };
    prisma.inventoryMovement.findMany.mockResolvedValue([...expiryBatches, duplicateBatch]);
    prisma.stockBalance.findMany.mockResolvedValue([
      {
        productId: 'product-a',
        locationId: 'location-a',
        quantity: expiryBatches.length + 1,
        product: { defaultUnit: { symbol: 'btl' } },
      },
    ]);
    const service = new InventoryService(prisma as PrismaService, {} as never);

    const report = await service.getStockExpiryReport('business-a', 'owner-a', {
      page: 1,
      limit: 20,
      status: 'ALL',
      asOfDate: '2026-11-20',
    } as never);

    expect(report.total).toBe(6);
    expect(report.data.filter((row) => row.batchNumber === 'expired-yesterday')).toHaveLength(1);
    expect(report.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ batchNumber: 'expired-yesterday', quantity: 2 }),
      ]),
    );
  });

  it('limits expiry layers and untracked quantities to active locations assigned to the user', async () => {
    const prisma = setup();
    prisma.user.findFirst.mockResolvedValue({
      userRoles: [{ role: { name: 'Staff', isSystem: false } }],
      assignedLocations: [{ id: 'location-a' }],
    });
    const service = new InventoryService(prisma as PrismaService, {} as never);

    await service.getStockExpiryReport('business-a', 'staff-a', { page: 1, limit: 20 } as never);

    expect(prisma.location.findMany).toHaveBeenCalledWith({
      where: { businessId: 'business-a', isActive: true, id: { in: ['location-a'] } },
      select: { id: true },
    });
    expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          location: { businessId: 'business-a', id: { in: ['location-a'] } },
        }),
      }),
    );
    expect(prisma.stockBalance.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          location: { businessId: 'business-a', id: { in: ['location-a'] } },
        }),
      }),
    );
  });

  it('reports untracked stock quantities separately by base unit', async () => {
    const prisma = setup();
    prisma.stockBalance.findMany.mockResolvedValue([
      {
        productId: 'product-a',
        locationId: 'location-a',
        quantity: 6,
        product: {
          id: 'product-a',
          name: 'Expiry QA product',
          sku: 'EXP-QA-1',
          buyingPrice: 100,
          defaultUnit: { symbol: 'btl' },
        },
        location: { id: 'location-a', name: 'Main Warehouse' },
      },
      {
        productId: 'product-b',
        locationId: 'location-a',
        quantity: 2,
        product: {
          id: 'product-b',
          name: 'Bag product',
          sku: 'BAG-1',
          buyingPrice: 100,
          defaultUnit: { symbol: 'bag' },
        },
        location: { id: 'location-a', name: 'Main Warehouse' },
      },
      {
        productId: 'product-c',
        locationId: 'location-a',
        quantity: 4,
        product: {
          id: 'product-c',
          name: 'Count product',
          sku: 'UNIT-1',
          buyingPrice: 100,
          defaultUnit: { symbol: 'UNIT' },
        },
        location: { id: 'location-a', name: 'Main Warehouse' },
      },
    ]);
    const service = new InventoryService(prisma as PrismaService, {} as never);

    const report = await service.getStockExpiryReport('business-a', 'owner-a', {
      page: 1,
      limit: 20,
      status: 'ALL',
    } as never);

    expect(report.untrackedExpiryQuantity).toBe(6);
    expect(report.untrackedExpiryQuantityByUnit).toEqual([
      { unit: 'bag', quantity: 2 },
      { unit: 'UNIT', quantity: 4 },
    ]);
  });

  it('removes a dated adjustment from its named batch without consuming another batch', () => {
    const service = new InventoryService(createPrismaMock() as PrismaService, {} as never);
    const movements = [
      {
        productId: 'product-a',
        locationId: 'location-a',
        quantity: 3,
        batchNumber: 'LOT-A',
        expiryDate: new Date('2026-12-21T00:00:00.000Z'),
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
        unitCost: 100,
      },
      {
        productId: 'product-a',
        locationId: 'location-a',
        quantity: 4,
        batchNumber: 'LOT-B',
        expiryDate: new Date('2027-01-15T00:00:00.000Z'),
        createdAt: new Date('2026-11-02T00:00:00.000Z'),
        unitCost: 120,
      },
      {
        productId: 'product-a',
        locationId: 'location-a',
        quantity: -2,
        batchNumber: 'LOT-A',
        expiryDate: new Date('2026-12-21T00:00:00.000Z'),
        createdAt: new Date('2026-11-03T00:00:00.000Z'),
        unitCost: 100,
      },
    ];

    const remaining = (service as any).replayLayers(movements, 'FIFO');

    expect(
      remaining.map((layer: any) => [layer.batchNumber, layer.quantity, layer.expiryDate]),
    ).toEqual([
      ['LOT-A', 1, new Date('2026-12-21T00:00:00.000Z')],
      ['LOT-B', 4, new Date('2027-01-15T00:00:00.000Z')],
    ]);
  });

  it('clearly rejects adding a new expiry-tracked batch without an expiry date', async () => {
    const service = new InventoryService(createPrismaMock() as PrismaService, {} as never);
    const tx = { inventoryMovement: { findFirst: jest.fn().mockResolvedValue(null) } };

    await expect(
      (service as any).resolveInventoryExpiry(
        tx,
        'business-a',
        'product-a',
        'location-a',
        'NEW-LOT',
        undefined,
        true,
        true,
      ),
    ).rejects.toThrow('Expiry date is required for a new batch');
    expect(tx.inventoryMovement.findFirst).toHaveBeenCalledTimes(1);
  });

  it('rejects adding stock to a batch whose expiry is today or earlier', () => {
    const service = new InventoryService(createPrismaMock() as PrismaService, {} as never);
    const today = new Date(
      `${new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Dar_es_Salaam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date())}T00:00:00.000Z`,
    );
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    expect(() =>
      (service as any).assertExpiryAfterToday(yesterday, 'Africa/Dar_es_Salaam'),
    ).toThrow('Expiry date must be after today to add stock');
    expect(() => (service as any).assertExpiryAfterToday(today, 'Africa/Dar_es_Salaam')).toThrow(
      'Expiry date must be after today to add stock',
    );
    expect(() =>
      (service as any).assertExpiryAfterToday(tomorrow, 'Africa/Dar_es_Salaam'),
    ).not.toThrow();
  });

  it('revalidates pending expiry-tracked adjustments before posting stock', async () => {
    const prisma = createPrismaMock();
    const service = new InventoryService(prisma as PrismaService, {} as never);
    const today = new Date(
      `${new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Dar_es_Salaam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date())}T00:00:00.000Z`,
    );
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const adjustment = {
      id: 'adjustment-a',
      status: 'PENDING',
      items: [
        {
          id: 'item-a',
          productId: 'product-a',
          locationId: 'location-a',
          difference: 1,
          expiryDate: yesterday,
          product: {
            id: 'product-a',
            name: 'QA expiry product',
            requiresExpiry: true,
            buyingPrice: 100,
          },
        },
      ],
    };
    jest.spyOn(service, 'getStockAdjustmentById').mockResolvedValue(adjustment as never);
    prisma.stockAdjustment.findFirst.mockResolvedValue(adjustment);
    prisma.stockAdjustment.updateMany.mockResolvedValue({ count: 1 });
    prisma.business.findUnique.mockResolvedValue({
      allowNegativeStock: false,
      timezone: 'Africa/Dar_es_Salaam',
    });

    await expect(
      service.approveStockAdjustment('business-a', 'adjustment-a', 'owner-a'),
    ).rejects.toThrow('Expiry date must be after today to add stock');
    expect(prisma.stockBalance.update).not.toHaveBeenCalled();
    expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('InventoryService expiry batch allocation', () => {
  it('allocates the earliest-expiring eligible batches and excludes expired or untracked stock', async () => {
    const prisma = createPrismaMock();
    const service = new InventoryService(prisma as PrismaService, {} as never);
    prisma.business.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.stockBalance.findUnique.mockResolvedValue({
      product: {
        name: 'Expiry product',
        sku: 'EXP-1',
        buyingPrice: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      location: { name: 'Warehouse' },
    });
    prisma.inventoryMovement.findMany.mockResolvedValue([]);
    jest.spyOn(service as any, 'replayLayers').mockReturnValue([
      {
        quantity: 2,
        batchNumber: 'LOT-LATE',
        expiryDate: new Date('2027-02-01T00:00:00.000Z'),
        receivedAt: new Date('2026-01-02T00:00:00.000Z'),
        untracked: false,
      },
      {
        quantity: 1,
        batchNumber: 'LOT-SOON',
        expiryDate: new Date('2026-12-01T00:00:00.000Z'),
        receivedAt: new Date('2026-01-03T00:00:00.000Z'),
        untracked: false,
      },
      {
        quantity: 5,
        batchNumber: 'LOT-EXPIRED',
        expiryDate: new Date('2026-01-01T00:00:00.000Z'),
        receivedAt: new Date('2025-01-01T00:00:00.000Z'),
        untracked: false,
      },
      { quantity: 4, batchNumber: null, expiryDate: null, untracked: true },
    ]);

    const allocations = await service.allocateExpiryTrackedStock(
      prisma,
      'business-a',
      'product-a',
      'location-a',
      2,
      12,
      'Expiry product',
    );

    expect(allocations).toEqual([
      { quantity: 1, batchNumber: 'LOT-SOON', expiryDate: new Date('2026-12-01T00:00:00.000Z') },
      { quantity: 1, batchNumber: 'LOT-LATE', expiryDate: new Date('2027-02-01T00:00:00.000Z') },
    ]);
  });

  it('blocks a sale when only untracked or expired quantities can cover it', async () => {
    const prisma = createPrismaMock();
    const service = new InventoryService(prisma as PrismaService, {} as never);
    prisma.business.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.stockBalance.findUnique.mockResolvedValue({
      product: {
        name: 'Expiry product',
        sku: 'EXP-1',
        buyingPrice: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      location: { name: 'Warehouse' },
    });
    prisma.inventoryMovement.findMany.mockResolvedValue([]);
    jest.spyOn(service as any, 'replayLayers').mockReturnValue([
      {
        quantity: 3,
        batchNumber: 'LOT-EXPIRED',
        expiryDate: new Date('2026-01-01T00:00:00.000Z'),
        receivedAt: new Date('2025-01-01T00:00:00.000Z'),
        untracked: false,
      },
      { quantity: 2, batchNumber: null, expiryDate: null, untracked: true },
    ]);

    await expect(
      service.allocateExpiryTrackedStock(
        prisma,
        'business-a',
        'product-a',
        'location-a',
        1,
        5,
        'Expiry product',
      ),
    ).rejects.toThrow(
      'Insufficient non-expired, batch-tracked stock for Expiry product; available: 0',
    );
  });
});

describe('InventoryService physical count lifecycle', () => {
  const makeCount = (status: string, systemQuantity = 5, countedQuantity = 4) => ({
    id: 'count-a',
    businessId: 'business-a',
    locationId: 'location-a',
    countNumber: 'CNT-QA-1',
    status,
    items: [
      {
        id: 'line-a',
        productId: 'product-a',
        systemQuantity,
        countedQuantity,
        variance: countedQuantity - systemQuantity,
        product: { id: 'product-a', name: 'QA product', sku: 'QA-1', buyingPrice: 1000 },
      },
    ],
  });

  function setup(count: ReturnType<typeof makeCount>) {
    const prisma = createPrismaMock();
    const notifications = { checkStockLevel: jest.fn().mockResolvedValue(undefined) };
    const service = new InventoryService(prisma as PrismaService, notifications as never);
    jest.spyOn(service, 'getPhysicalCountById').mockResolvedValue(count as never);
    prisma.physicalCount.findFirst.mockResolvedValue(count);
    prisma.physicalCount.update.mockImplementation(async ({ data }: any) => ({
      ...count,
      ...data,
    }));
    prisma.business.findUnique.mockResolvedValue({ allowNegativeStock: false });
    prisma.stockBalance.upsert.mockResolvedValue({ quantity: count.items[0].systemQuantity });
    prisma.$queryRaw.mockResolvedValue([{ quantity: count.items[0].systemQuantity }]);
    return { prisma, service, notifications };
  }

  it('persists draft variance summary when the count snapshot is created', async () => {
    const prisma = createPrismaMock();
    const product = {
      id: 'product-a',
      name: 'QA product',
      sku: 'QA-1',
      status: 'ACTIVE',
      buyingPrice: 1000,
    };
    prisma.user.findFirst.mockResolvedValue({
      userRoles: [{ role: { name: 'Owner', isSystem: true } }],
      assignedLocations: [],
    });
    prisma.location.findFirst.mockResolvedValue({
      id: 'location-a',
      businessId: 'business-a',
      isActive: true,
    });
    prisma.physicalCount.findMany.mockResolvedValue([]);
    prisma.stockBalance.findUnique.mockResolvedValue({ quantity: 5 });
    prisma.product.findFirst.mockResolvedValue(product);
    prisma.physicalCount.create.mockImplementation(async ({ data }: any) => ({
      id: 'count-a',
      ...data,
      location: { id: 'location-a', name: 'QA location' },
      items: data.items.create.map((item: any) => ({ id: 'line-a', ...item, product })),
    }));
    const service = new InventoryService(prisma as PrismaService, {} as never);

    const result = await service.createPhysicalCount('business-a', 'owner-a', {
      locationId: 'location-a',
      items: [{ productId: 'product-a', countedQuantity: 4 }],
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'DRAFT', varianceCount: 1, totalVarianceAmount: 1000 }),
    );
    expect(prisma.physicalCount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          varianceCount: 1,
          totalVarianceAmount: 1000,
          items: {
            create: [
              expect.objectContaining({ systemQuantity: 5, countedQuantity: 4, variance: -1 }),
            ],
          },
        }),
      }),
    );
    expect(prisma.stockBalance.update).not.toHaveBeenCalled();
    expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'CREATE', entityId: 'count-a' }),
    });
  });

  it('snapshots an expiry-tracked count by batch and carries the batch expiry into the count line', async () => {
    const prisma = createPrismaMock();
    const expiryDate = new Date('2026-12-21T00:00:00.000Z');
    const product = {
      id: 'product-a',
      name: 'QA expiry product',
      sku: 'EXP-QA-1',
      status: 'ACTIVE',
      buyingPrice: 1000,
      requiresExpiry: true,
    };
    const balance = {
      quantity: 3,
      product: {
        name: product.name,
        sku: product.sku,
        buyingPrice: 1000,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      location: { name: 'QA location' },
    };
    prisma.user.findFirst.mockResolvedValue({
      userRoles: [{ role: { name: 'Owner', isSystem: true } }],
      assignedLocations: [],
    });
    prisma.location.findFirst.mockResolvedValue({
      id: 'location-a',
      businessId: 'business-a',
      isActive: true,
    });
    prisma.physicalCount.findMany.mockResolvedValue([]);
    prisma.stockBalance.findUnique.mockResolvedValue(balance);
    prisma.inventoryMovement.findMany.mockResolvedValue([
      {
        productId: 'product-a',
        locationId: 'location-a',
        type: 'PURCHASE',
        quantity: 3,
        batchNumber: 'LOT-A',
        expiryDate,
        unitCost: 1000,
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
        product: { name: product.name, sku: product.sku, buyingPrice: 1000 },
        location: { name: 'QA location' },
      },
    ]);
    prisma.inventoryMovement.findFirst.mockResolvedValue({ expiryDate });
    prisma.product.findFirst.mockResolvedValue(product);
    prisma.physicalCount.create.mockImplementation(async ({ data }: any) => ({
      id: 'count-a',
      ...data,
      location: { id: 'location-a', name: 'QA location' },
      items: data.items.create.map((item: any) => ({ id: 'line-a', ...item, product })),
    }));
    const service = new InventoryService(prisma as PrismaService, {} as never);

    await service.createPhysicalCount('business-a', 'owner-a', {
      locationId: 'location-a',
      items: [{ productId: 'product-a', batchNumber: ' LOT-A ', countedQuantity: 2 }],
    });

    expect(prisma.physicalCount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                batchNumber: 'LOT-A',
                systemQuantity: 3,
                countedQuantity: 2,
                variance: -1,
                expiryDate,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('completes a count without touching balances or movements and persists variance summary', async () => {
    const count = makeCount('DRAFT', 5, 4);
    const { prisma, service } = setup(count);
    prisma.product.findMany.mockResolvedValue([{ id: 'product-a', buyingPrice: 1000 }]);

    const result = await service.completePhysicalCount('business-a', 'count-a', 'owner-a');

    expect(result).toEqual(
      expect.objectContaining({ status: 'COMPLETED', varianceCount: 1, totalVarianceAmount: 1000 }),
    );
    expect(prisma.stockBalance.update).not.toHaveBeenCalled();
    expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'COMPLETE', entityId: 'count-a' }),
    });
  });

  it('rejects duplicate completion without an update or stock movement', async () => {
    const count = makeCount('COMPLETED');
    const { prisma, service } = setup(count);

    await expect(service.completePhysicalCount('business-a', 'count-a', 'owner-a')).rejects.toThrow(
      'Only DRAFT physical counts can be completed',
    );
    expect(prisma.physicalCount.update).not.toHaveBeenCalled();
    expect(prisma.stockBalance.update).not.toHaveBeenCalled();
    expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('rejects posting a stale snapshot without changing balance, status, movement, or audit', async () => {
    const count = makeCount('COMPLETED', 5, 4);
    const { prisma, service } = setup(count);
    prisma.$queryRaw.mockResolvedValue([{ quantity: 6 }]);

    await expect(service.postPhysicalCount('business-a', 'count-a', 'owner-a')).rejects.toThrow(
      'Stock for QA product changed since the count snapshot; create a fresh count',
    );
    expect(prisma.stockBalance.update).not.toHaveBeenCalled();
    expect(prisma.physicalCount.update).not.toHaveBeenCalled();
    expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('posts a negative variance exactly once with a linked adjustment movement and POST audit', async () => {
    const count = makeCount('COMPLETED', 5, 4);
    const { prisma, service, notifications } = setup(count);

    await service.postPhysicalCount('business-a', 'count-a', 'owner-a');

    expect(prisma.stockBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId_locationId: { productId: 'product-a', locationId: 'location-a' } },
        data: { quantity: 4, lastMovementAt: expect.any(Date) },
      }),
    );
    expect(prisma.inventoryMovement.create).toHaveBeenCalledTimes(1);
    expect(prisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'ADJUSTMENT',
        quantity: -1,
        referenceId: 'count-a',
        referenceType: 'PhysicalCount',
        createdBy: 'owner-a',
      }),
    });
    expect(prisma.physicalCount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'count-a' },
        data: expect.objectContaining({ status: 'POSTED' }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'POST', entityId: 'count-a' }),
    });
    expect(notifications.checkStockLevel).toHaveBeenCalledWith(
      'business-a',
      'product-a',
      'location-a',
    );
  });

  it('posts a zero variance without creating a stock movement', async () => {
    const count = makeCount('COMPLETED', 5, 5);
    const { prisma, service, notifications } = setup(count);

    await service.postPhysicalCount('business-a', 'count-a', 'owner-a');

    expect(prisma.stockBalance.update).not.toHaveBeenCalled();
    expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    expect(prisma.physicalCount.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'POSTED' }) }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'POST', entityId: 'count-a' }),
    });
    expect(notifications.checkStockLevel).not.toHaveBeenCalled();
  });

  it('rejects duplicate posting without a second movement or audit', async () => {
    const count = makeCount('POSTED');
    const { prisma, service } = setup(count);

    await expect(service.postPhysicalCount('business-a', 'count-a', 'owner-a')).rejects.toThrow(
      'Only COMPLETED physical counts can be posted',
    );
    expect(prisma.stockBalance.upsert).not.toHaveBeenCalled();
    expect(prisma.physicalCount.update).not.toHaveBeenCalled();
    expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
