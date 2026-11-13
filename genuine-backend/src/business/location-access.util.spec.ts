import { ForbiddenException } from '@nestjs/common';
import { accessibleLocationIds } from '../common/utils/location-access.util';
import { PrismaService } from '../database/prisma.service';

describe('Location access policy', () => {
  it('lets a system Owner see all locations in their business', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({
      userRoles: [{ role: { name: 'Owner', isSystem: true } }], assignedLocations: [],
    }) } };
    await expect(accessibleLocationIds(prisma as unknown as PrismaService, 'business-a', 'owner-a')).resolves.toBeNull();
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'owner-a', businessId: 'business-a', isActive: true } }));
  });

  it('limits staff to their assigned active business locations', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({
      userRoles: [{ role: { name: 'Salesperson', isSystem: true } }],
      assignedLocations: [{ id: 'loc-a' }],
    }) } };
    await expect(accessibleLocationIds(prisma as unknown as PrismaService, 'business-a', 'staff-a')).resolves.toEqual(['loc-a']);
  });

  it('denies staff without an assigned location', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({ userRoles: [], assignedLocations: [] }) } };
    await expect(accessibleLocationIds(prisma as unknown as PrismaService, 'business-a', 'staff-a')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
