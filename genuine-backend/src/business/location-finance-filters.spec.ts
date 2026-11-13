import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoggerService } from '../common/logger/logger.service';
import { SalesService } from '../sales/sales.service';
import { PurchaseService } from '../purchases/purchase.service';
import { ExpensesService } from '../payments/expenses.service';
import { PaymentsService } from '../payments/payments.service';

function createPrismaMock() {
  return {
    user: { findFirst: jest.fn().mockResolvedValue({ userRoles: [{ role: { name: 'Manager', isSystem: true } }], assignedLocations: [{ id: 'location-a' }] }) },
    location: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

describe('Financial location filters', () => {
  it('rejects a location outside the business for sales invoice filters', async () => {
    const prisma = createPrismaMock();
    const service = new SalesService(
      prisma as unknown as PrismaService,
      {} as LoggerService,
      {} as InventoryService,
      {} as NotificationsService,
    );

    await expect(service.getAllSalesInvoices('business-a', 'user-a', { locationId: 'location-b' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.location.findFirst).toHaveBeenCalledWith({
      where: { id: 'location-b', businessId: 'business-a' },
      select: { id: true },
    });
  });

  it('rejects a location outside the business for purchase order filters', async () => {
    const prisma = createPrismaMock();
    const service = new PurchaseService(
      prisma as unknown as PrismaService,
      {} as LoggerService,
      {} as NotificationsService,
      {} as InventoryService,
    );

    await expect(service.getAllPurchaseOrders('business-a', 'user-a', { locationId: 'location-b' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.location.findFirst).toHaveBeenCalledWith({
      where: { id: 'location-b', businessId: 'business-a' },
      select: { id: true },
    });
  });

  it('rejects a location outside the business for expense filters', async () => {
    const prisma = createPrismaMock();
    const service = new ExpensesService(prisma as unknown as PrismaService, {} as NotificationsService);

    await expect(service.listExpenses('business-a', 'user-a', { locationId: 'location-b' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.location.findFirst).toHaveBeenCalledWith({
      where: { id: 'location-b', businessId: 'business-a' },
      select: { id: true },
    });
  });

  it('rejects a location outside the business for payment filters', async () => {
    const prisma = createPrismaMock();
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      {} as InventoryService,
      {} as NotificationsService,
    );

    await expect(service.getAllPayments('business-a', 'user-a', { locationId: 'location-b' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.location.findFirst).toHaveBeenCalledWith({
      where: { id: 'location-b', businessId: 'business-a' },
      select: { id: true },
    });
  });
});
