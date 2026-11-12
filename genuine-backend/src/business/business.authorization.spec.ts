import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';
import { PrismaService } from '../database/prisma.service';
import { PermissionGuard } from '../common/guards/permission.guard';
import { LoggerService } from '../common/logger/logger.service';
import { PERMISSION_KEY } from '../common/decorators';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';

function createPrismaMock() {
  const prisma = {
    role: { findFirst: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
    user: { findFirst: jest.fn(), findMany: jest.fn() },
    business: { findUnique: jest.fn(), update: jest.fn() },
    businessSettings: { findUnique: jest.fn(), upsert: jest.fn() },
    permission: { findMany: jest.fn() },
    userRole: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    userSession: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));
  return prisma;
}

function createService(prisma: ReturnType<typeof createPrismaMock>) {
  return new BusinessService(
    prisma as unknown as PrismaService,
    {} as ConfigService,
    {} as LoggerService,
  );
}

describe('Business user and role authorization boundaries', () => {
  it('does not list users through a role ID from another business', async () => {
    const prisma = createPrismaMock();
    prisma.role.findFirst.mockResolvedValue(null);
    const service = createService(prisma);

    await expect(service.listManagedUsers('business-a', 'role-from-business-b')).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.role.findFirst).toHaveBeenCalledWith({
      where: { id: 'role-from-business-b', businessId: 'business-a' },
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('does not update a user ID from another business', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = createService(prisma);

    await expect(service.updateManagedUser('business-a', 'owner-a', 'user-from-business-b', { firstName: 'Changed' })).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-from-business-b', businessId: 'business-a' },
    }));
  });

  it('does not assign a role ID from another business to a new user', async () => {
    const prisma = createPrismaMock();
    prisma.role.findFirst.mockResolvedValue(null);
    const service = createService(prisma);

    await expect(service.createManagedUser('business-a', 'owner-a', {
      email: 'new-user@example.test', firstName: 'New', lastName: 'User',
      password: 'ValidPass1!', roleId: 'role-from-business-b',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.role.findFirst).toHaveBeenCalledWith({
      where: { id: 'role-from-business-b', businessId: 'business-a' },
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('does not reset the password for a user ID from another business', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = createService(prisma);

    await expect(service.resetManagedUserPassword('business-a', 'owner-a', 'user-from-business-b', {
      newPassword: 'ValidPass1!',
    })).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-from-business-b', businessId: 'business-a' },
      select: { id: true },
    });
    expect(prisma.userSession.deleteMany).not.toHaveBeenCalled();
  });

  it('does not edit or delete a role ID from another business', async () => {
    const prisma = createPrismaMock();
    prisma.role.findFirst.mockResolvedValue(null);
    const service = createService(prisma);

    await expect(service.updateRole('business-a', 'owner-a', 'role-from-business-b', { name: 'Changed' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteRole('business-a', 'owner-a', 'role-from-business-b')).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.role.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: 'role-from-business-b', businessId: 'business-a' },
    }));
    expect(prisma.role.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: 'role-from-business-b', businessId: 'business-a' },
    }));
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('blocks a salesperson from the business role API when no accepted permission is present', async () => {
    const prisma = createPrismaMock();
    const requiredPermissions = ['roles.manage', 'users.view', 'users.create', 'users.edit'];
    const reflector = { get: jest.fn().mockReturnValue(requiredPermissions) } as unknown as Reflector;
    const guard = new PermissionGuard(reflector, prisma as unknown as PrismaService);
    const handler = () => undefined;
    const request = {
      user: { id: 'salesperson-a', businessId: 'business-a', permissions: ['sales.view'], userRoles: [] },
      method: 'GET',
      originalUrl: '/api/v1/business/roles',
      path: '/api/v1/business/roles',
    };
    const context = {
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('allows the role list API when the user has one of its allowed access permissions', async () => {
    const prisma = createPrismaMock();
    const requiredPermissions = ['roles.manage', 'users.view', 'users.create', 'users.edit'];
    const reflector = { get: jest.fn().mockReturnValue(requiredPermissions) } as unknown as Reflector;
    const guard = new PermissionGuard(reflector, prisma as unknown as PrismaService);
    const request = {
      user: { id: 'user-manager-a', businessId: 'business-a', permissions: ['users.view'], userRoles: [] },
      method: 'GET',
      originalUrl: '/api/v1/business/roles',
      path: '/api/v1/business/roles',
    };
    const context = {
      getHandler: () => () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });

  it('rejects a settings.view user attempting the business profile mutation API', async () => {
    const prisma = createPrismaMock();
    const handler = BusinessController.prototype.updateBusinessProfile;
    const requiredPermissions = Reflect.getMetadata(PERMISSION_KEY, handler);
    expect(requiredPermissions).toEqual(['settings.edit']);
    const reflector = {
      get: jest.fn((key: string, target: Function) => Reflect.getMetadata(key, target)),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector, prisma as unknown as PrismaService);
    const request = {
      user: { id: 'settings-viewer-a', businessId: 'business-a', permissions: ['settings.view'], userRoles: [] },
      method: 'PATCH',
      originalUrl: '/api/v1/business/profile',
      path: '/api/v1/business/profile',
      ip: '127.0.0.1',
      get: () => 'business-authorization-test',
    };
    const context = {
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        businessId: 'business-a',
        entityType: 'Authorization',
        action: 'ACCESS_DENIED',
      }),
    }));
  });

  it('keeps general settings updates scoped to the selected business', async () => {
    const prisma = createPrismaMock();
    const settingsByBusiness = new Map<string, Record<string, unknown>>([
      ['business-a', { businessId: 'business-a', invoicePrefix: 'A-INV-', lowStockThreshold: 5 }],
      ['business-b', { businessId: 'business-b', invoicePrefix: 'B-INV-', lowStockThreshold: 12 }],
    ]);
    prisma.businessSettings.findUnique.mockImplementation(({ where }: { where: { businessId: string } }) =>
      Promise.resolve(settingsByBusiness.get(where.businessId) ?? null),
    );
    prisma.businessSettings.upsert.mockImplementation(({ where, create, update }: {
      where: { businessId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const businessId = where.businessId;
      const row = { ...(settingsByBusiness.get(businessId) ?? create), ...update, businessId };
      settingsByBusiness.set(businessId, row);
      return Promise.resolve(row);
    });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-settings-a' });
    const service = createService(prisma);

    await service.updateBusinessSettings('business-a', 'owner-a', { invoicePrefix: 'A-UPDATED-' });
    const businessASettings = await service.getBusinessSettings('business-a');
    const businessBSettings = await service.getBusinessSettings('business-b');

    expect(businessASettings.invoicePrefix).toBe('A-UPDATED-');
    expect(businessBSettings.invoicePrefix).toBe('B-INV-');
    expect(prisma.businessSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: 'business-a' },
      update: { invoicePrefix: 'A-UPDATED-' },
    }));
    expect(prisma.businessSettings.findUnique).toHaveBeenNthCalledWith(2, { where: { businessId: 'business-a' } });
    expect(prisma.businessSettings.findUnique).toHaveBeenNthCalledWith(3, { where: { businessId: 'business-b' } });
  });
});
