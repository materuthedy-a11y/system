import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import 'reflect-metadata';
import { AnalyticsController } from './analytics.controller';
import { PERMISSION_KEY } from '../common/decorators/permission.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PrismaService } from '../database/prisma.service';

function guardFor(
  user: Record<string, unknown>,
  prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } },
) {
  const reflector = new Reflector();
  const guard = new PermissionGuard(reflector, prisma as unknown as PrismaService);
  const request = {
    user,
    method: 'GET',
    originalUrl: '/api/v1/analytics/export?reportType=DASHBOARD',
    path: '/api/v1/analytics/export',
  };
  const context = {
    getHandler: () => AnalyticsController.prototype.export,
    switchToHttp: () => ({ getRequest: () => request }),
  };
  return { guard, context, prisma };
}

describe('Reports authorization contract', () => {
  it('requires report view for data endpoints and report export for file generation', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, AnalyticsController.prototype.executive)).toEqual([
      'reports.view',
    ]);
    expect(Reflect.getMetadata(PERMISSION_KEY, AnalyticsController.prototype.export)).toEqual([
      'reports.export',
    ]);
    expect(
      Reflect.getMetadata(PERMISSION_KEY, AnalyticsController.prototype.reportSettings),
    ).toEqual(['reports.view']);
  });

  it('denies export to a view-only account and records the denied read', async () => {
    const { guard, context, prisma } = guardFor({
      id: 'viewer-a',
      businessId: 'business-a',
      permissions: ['reports.view'],
      userRoles: [],
    });
    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'business-a',
          userId: 'viewer-a',
          action: 'ACCESS_DENIED',
        }),
      }),
    );
  });

  it('does not accept an export-only grant as report viewing permission', async () => {
    const reflector = new Reflector();
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const guard = new PermissionGuard(reflector, prisma as unknown as PrismaService);
    const request = {
      user: {
        id: 'exporter-a',
        businessId: 'business-a',
        permissions: ['reports.export'],
        userRoles: [],
      },
      method: 'GET',
    };
    const context = {
      getHandler: () => AnalyticsController.prototype.executive,
      switchToHttp: () => ({ getRequest: () => request }),
    };
    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
