import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Location visibility: business owners/admins see all; staff see only locations they manage. */
export async function accessibleLocationIds(
  prisma: PrismaService,
  businessId: string,
  userId: string,
): Promise<string[] | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, businessId, isActive: true },
    select: {
      userRoles: { select: { role: { select: { name: true, isSystem: true } } } },
      assignedLocations: { where: { businessId, isActive: true }, select: { id: true } },
    },
  });
  if (!user) throw new NotFoundException('User not found');
  if (user.userRoles.some(({ role }) => role.isSystem && ['Owner', 'Admin'].includes(role.name))) return null;
  const ids = user.assignedLocations.map(({ id }) => id);
  if (!ids.length) throw new ForbiddenException('Ask an administrator to assign you a business location');
  return ids;
}

export async function assertLocationAccess(
  prisma: PrismaService,
  businessId: string,
  userId: string,
  locationId: string,
) {
  const allowed = await accessibleLocationIds(prisma, businessId, userId);
  if (allowed && !allowed.includes(locationId)) throw new ForbiddenException('You do not have access to this location');
}
