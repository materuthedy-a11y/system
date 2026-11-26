import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';
import { LoggerService } from '../common/logger/logger.service';
import { PrismaService } from '../database/prisma.service';
import { BusinessService } from './business.service';

function createPrismaMock() {
  const prisma: any = {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    location: { findFirst: jest.fn(), create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: any) => unknown) => work(prisma));
  return prisma;
}

describe('BusinessService location creation', () => {
  it('creates a location and audits it in the same transaction', async () => {
    const prisma = createPrismaMock();
    const createdAt = new Date('2026-11-26T20:00:00.000Z');
    const location = {
      id: 'location-a',
      businessId: 'business-a',
      name: 'QA location',
      code: 'QA-LOC',
      type: 'WAREHOUSE',
      address: 'Local QA only',
      description: null,
      managerId: 'owner-a',
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    };
    prisma.user.findUnique.mockResolvedValue({ id: 'owner-a', businessId: 'business-a' });
    prisma.location.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({ id: 'owner-a' });
    prisma.location.create.mockResolvedValue(location);
    const service = new BusinessService(
      prisma as PrismaService,
      {} as ConfigService,
      { log: jest.fn() } as unknown as LoggerService,
    );

    await expect(
      service.createLocation('business-a', 'owner-a', {
        name: location.name,
        code: location.code,
        type: 'WAREHOUSE',
        address: location.address,
        managerId: location.managerId,
      }),
    ).resolves.toEqual(location);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        businessId: 'business-a',
        userId: 'owner-a',
        entityType: 'Location',
        entityId: 'location-a',
        action: 'CREATE',
        afterData: JSON.stringify(location),
        description: 'CREATE Location',
      },
    });
  });
});
