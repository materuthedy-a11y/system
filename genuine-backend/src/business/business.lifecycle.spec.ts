import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import 'reflect-metadata';
import { PrismaService } from '../database/prisma.service';
import { LoggerService } from '../common/logger/logger.service';
import { BusinessService } from './business.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const compareMock = bcrypt.compare as jest.Mock;

function createPrismaMock() {
  const prisma = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), count: jest.fn() },
    userRole: { findFirst: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
    role: { findFirst: jest.fn() },
    business: { update: jest.fn(), findMany: jest.fn() },
    userSession: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));
  return prisma;
}

function createService(prisma: ReturnType<typeof createPrismaMock>) {
  return new BusinessService(prisma as unknown as PrismaService, {} as ConfigService, {} as LoggerService);
}

const OWNER_ASSIGNMENT = { userId: 'owner-a' };

describe('closeBusiness', () => {
  beforeEach(() => compareMock.mockReset());

  it('rejects a non-owner', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 'staff-a', businessId: 'biz-a', isActive: true, passwordHash: 'x' });
    prisma.userRole.findFirst.mockResolvedValue(null);
    const service = createService(prisma);

    await expect(service.closeBusiness('biz-a', 'staff-a', 'pw')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 'owner-a', businessId: 'biz-a', isActive: true, passwordHash: 'hash' });
    prisma.userRole.findFirst.mockResolvedValue(OWNER_ASSIGNMENT);
    compareMock.mockResolvedValue(false);
    const service = createService(prisma);

    await expect(service.closeBusiness('biz-a', 'owner-a', 'wrong')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it('soft-deletes the business, kills sessions and audits on success', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 'owner-a', businessId: 'biz-a', isActive: true, passwordHash: 'hash' });
    prisma.userRole.findFirst.mockResolvedValue(OWNER_ASSIGNMENT);
    compareMock.mockResolvedValue(true);
    const service = createService(prisma);

    const result = await service.closeBusiness('biz-a', 'owner-a', 'correct');

    expect(result.scheduledDeletionAt).toBeInstanceOf(Date);
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-a' },
        data: expect.objectContaining({ isActive: false, deletedById: 'owner-a' }),
      }),
    );
    const updateData = prisma.business.update.mock.calls[0][0].data;
    expect(updateData.deletedAt).toBeInstanceOf(Date);
    expect(updateData.deletionScheduledAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({ where: { user: { businessId: 'biz-a' } } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entityType: 'Business', action: 'DELETE' }) }),
    );
  });
});

describe('transferOwnership', () => {
  it('rejects a non-owner', async () => {
    const prisma = createPrismaMock();
    prisma.userRole.findFirst.mockResolvedValue(null);
    const service = createService(prisma);

    await expect(service.transferOwnership('biz-a', 'staff-a', 'user-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a target outside the business', async () => {
    const prisma = createPrismaMock();
    prisma.userRole.findFirst.mockResolvedValue(OWNER_ASSIGNMENT);
    prisma.user.findFirst.mockResolvedValue(null);
    const service = createService(prisma);

    await expect(service.transferOwnership('biz-a', 'owner-a', 'user-x')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.userRole.create).not.toHaveBeenCalled();
  });

  it('moves the Owner role to the target user and audits', async () => {
    const prisma = createPrismaMock();
    prisma.userRole.findFirst.mockResolvedValue(OWNER_ASSIGNMENT);
    prisma.user.findFirst.mockResolvedValue({ id: 'user-b', businessId: 'biz-a', isActive: true });
    prisma.role.findFirst.mockResolvedValue({ id: 'role-owner', businessId: 'biz-a', name: 'Owner', isSystem: true });
    const service = createService(prisma);

    await service.transferOwnership('biz-a', 'owner-a', 'user-b');

    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-owner' } });
    expect(prisma.userRole.create).toHaveBeenCalledWith({ data: { userId: 'user-b', roleId: 'role-owner' } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entityType: 'User', entityId: 'user-b' }) }),
    );
  });
});

describe('purgeExpiredBusinesses', () => {
  it('anonymizes users and scrubs business PII for expired businesses', async () => {
    const prisma = createPrismaMock();
    prisma.business.findMany.mockResolvedValue([
      { id: 'biz-old', users: [{ id: 'u1' }, { id: 'u2' }] },
    ]);
    const service = createService(prisma);

    const result = await service.purgeExpiredBusinesses();

    expect(result.purged).toBe(1);
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          email: 'deleted-u1@deleted.local',
          passwordHash: '!',
          anonymizedAt: expect.any(Date),
          isActive: false,
        }),
      }),
    );
    expect(prisma.userSession.deleteMany).toHaveBeenCalledTimes(2);
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-old' },
        data: expect.objectContaining({ name: 'deleted-biz-old', isActive: false }),
      }),
    );
  });

  it('returns zero when nothing is expired', async () => {
    const prisma = createPrismaMock();
    prisma.business.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    await expect(service.purgeExpiredBusinesses()).resolves.toEqual({ purged: 0 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
