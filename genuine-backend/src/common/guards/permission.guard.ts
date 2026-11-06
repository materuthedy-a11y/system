import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(PERMISSION_KEY, context.getHandler());

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context not found');
    }

    // Extract all permission keys from user object or userRoles
    const userPermKeys: string[] = [];

    if (Array.isArray(user.permissions)) {
      user.permissions.forEach((p: any) => {
        if (typeof p === 'string') userPermKeys.push(p);
        else if (p?.key) userPermKeys.push(p.key);
      });
    }

    if (Array.isArray(user.userRoles)) {
      user.userRoles.forEach((ur: any) => {
        if (Array.isArray(ur.role?.permissions)) {
          ur.role.permissions.forEach((p: any) => {
            if (typeof p === 'string') userPermKeys.push(p);
            else if (p?.key) userPermKeys.push(p.key);
          });
        }
      });
    }

    // Check if user has at least one required permission
    const hasPermission = requiredPermissions.some((permission) =>
      userPermKeys.includes(permission),
    );

    if (!hasPermission) {
      const request = context.switchToHttp().getRequest();
      if (request.method !== 'GET' && user.id && user.businessId) {
        try {
          await this.prisma.auditLog.create({ data: {
            businessId: user.businessId,
            userId: user.id,
            entityType: 'Authorization',
            entityId: String(request.originalUrl || request.path || 'unknown').split('?')[0].slice(0, 180),
            action: 'ACCESS_DENIED',
            ipAddress: request.ip || null,
            userAgent: request.get?.('user-agent')?.slice(0, 500) || null,
            description: `Blocked ${request.method} request; missing required permission`,
            afterData: JSON.stringify({ method: request.method, requiredPermissions }),
          } });
        } catch {
          // Authorization must still reject the request even if the audit store is unavailable.
        }
      }
      throw new ForbiddenException(
        `Missing required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
