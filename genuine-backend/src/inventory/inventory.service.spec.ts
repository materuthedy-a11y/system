import { InventoryService } from './inventory.service';
import { PrismaService } from '../database/prisma.service';

function createPrismaMock() {
  const prisma: any = {
    user: { findFirst: jest.fn() },
    stockBalance: { findMany: jest.fn(), groupBy: jest.fn() },
    product: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    inventoryMovement: { findMany: jest.fn(), groupBy: jest.fn() },
    stockAdjustment: { count: jest.fn() },
    stockTransfer: { count: jest.fn() },
    physicalCount: { count: jest.fn() },
    businessSettings: { findUnique: jest.fn() },
    location: { findMany: jest.fn(), findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((callback: (tx: any) => unknown) => callback(prisma));
  return prisma;
}

describe('InventoryService location scope and thresholds', () => {
  it('updates reorder thresholds and records the exact before/after audit values', async () => {
    const prisma = createPrismaMock();
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-a', businessId: 'business-a', status: 'ACTIVE', name: 'QA product', sku: 'QA-1',
      minimumStock: 4, reorderLevel: 4, buyingPrice: 100,
    });
    prisma.product.update.mockResolvedValue({
      id: 'product-a', name: 'QA product', sku: 'QA-1', minimumStock: 4, reorderLevel: 12, buyingPrice: 100,
    });

    const service = new InventoryService(prisma as PrismaService, {} as never);
    const result = await service.updateReorderPoint('business-a', 'owner-a', 'product-a', {
      minimumStock: 4, reorderLevel: 12,
    });

    expect(result).toEqual(expect.objectContaining({ minimumStock: 4, reorderLevel: 12 }));
    expect(prisma.product.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-a' }, data: { minimumStock: 4, reorderLevel: 12 },
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      businessId: 'business-a', userId: 'owner-a', action: 'UPDATE_REORDER_POINTS', entityId: 'product-a',
      beforeData: JSON.stringify({ minimumStock: 4, reorderLevel: 4 }),
      afterData: JSON.stringify({ minimumStock: 4, reorderLevel: 12 }),
    }) });
  });

  it('treats saving unchanged reorder thresholds as an idempotent no-op without audit noise', async () => {
    const prisma = createPrismaMock();
    const existing = {
      id: 'product-a', businessId: 'business-a', status: 'ACTIVE', name: 'QA product', sku: 'QA-1',
      minimumStock: 4, reorderLevel: 12, buyingPrice: 100,
    };
    prisma.product.findFirst.mockResolvedValue(existing);

    const service = new InventoryService(prisma as PrismaService, {} as never);
    const result = await service.updateReorderPoint('business-a', 'owner-a', 'product-a', {
      minimumStock: 4, reorderLevel: 12,
    });

    expect(result).toEqual(expect.objectContaining({ minimumStock: 4, reorderLevel: 12 }));
    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects minimum stock above reorder level without changing the product or audit log', async () => {
    const prisma = createPrismaMock();
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-a', businessId: 'business-a', status: 'ACTIVE', minimumStock: 4, reorderLevel: 12,
    });

    const service = new InventoryService(prisma as PrismaService, {} as never);
    await expect(service.updateReorderPoint('business-a', 'owner-a', 'product-a', {
      minimumStock: 13, reorderLevel: 12,
    })).rejects.toThrow('Minimum stock cannot exceed reorder level');
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
      { productId: 'product-a', locationId: 'location-a', quantity: 5, product: { defaultUnit: { symbol: 'PCS' } } },
      { productId: 'product-a', locationId: 'location-b', quantity: 0, product: { defaultUnit: { symbol: 'PCS' } } },
      { productId: 'product-b', locationId: 'location-b', quantity: 3, product: { defaultUnit: { symbol: 'BOX' } } },
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
    expect(result.stockQuantitiesByUnit).toEqual([{ unit: 'BOX', quantity: 3 }, { unit: 'PCS', quantity: 5 }]);
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

    expect(prisma.stockBalance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { product: { businessId: 'business-a' }, location: { businessId: 'business-a', id: { in: ['location-a'] } } },
    }));
    expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ location: { businessId: 'business-a', id: { in: ['location-a'] } } }),
    }));
    expect(prisma.stockAdjustment.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ items: { some: { locationId: { in: ['location-a'] } }, every: { locationId: { in: ['location-a'] } } } }),
    }));
    expect(prisma.stockTransfer.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ fromLocationId: { in: ['location-a'] }, toLocationId: { in: ['location-a'] } }),
    }));
    expect(prisma.physicalCount.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ location: { id: { in: ['location-a'] } } }),
    }));
    expect(service.getStockValuationReport).toHaveBeenCalledWith('business-a', 'staff-a', expect.any(Object));
  });

  it('treats stock exactly at minimum as not below minimum but still at or below reorder', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      userRoles: [{ role: { name: 'Staff', isSystem: false } }],
      assignedLocations: [{ id: 'location-a' }],
    });
    prisma.product.findMany.mockResolvedValue([{
      id: 'product-a', name: 'Product A', sku: 'A', minimumStock: 5, reorderLevel: 10, buyingPrice: 100,
      stocks: [{ locationId: 'location-a', quantity: 5 }],
    }]);
    prisma.location.findMany.mockResolvedValue([{ id: 'location-a', name: 'Location A' }]);
    prisma.businessSettings.findUnique.mockResolvedValue({ lowStockThreshold: 0 });
    prisma.inventoryMovement.groupBy.mockResolvedValue([]);

    const service = new InventoryService(prisma as PrismaService, {} as never);
    const result = await service.getLowStockReport('business-a', 'staff-a', { page: 1, limit: 20 } as never);

    expect(result.data).toEqual([expect.objectContaining({
      quantity: 5,
      belowMinimum: false,
      atOrBelowReorderLevel: true,
    })]);
  });
});
