import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { LoggerService } from '../common/logger/logger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { durationSeconds } from './session-lifetime';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AuthResponseDto,
  PasswordResetRequestDto,
} from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private logger: LoggerService,
    private notifications: NotificationsService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return { avatar: user.avatar };
  }

  async getAvatar(userId: string): Promise<{ bytes: Buffer; mimeType: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });
    if (!user?.avatar) throw new BadRequestException('Profile photo not found');
    const encoded = user.avatar.match(/^data:(image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!encoded) throw new BadRequestException('Profile photo is invalid');
    const bytes = Buffer.from(encoded[2], 'base64');
    if (
      bytes.length === 0 ||
      bytes.length > 65_536 ||
      bytes.length < 12 ||
      bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WEBP'
    ) {
      throw new BadRequestException('Profile photo is invalid');
    }
    return { bytes, mimeType: encoded[1] };
  }

  async updateAvatar(userId: string, businessId: string, avatar: string) {
    const normalizedAvatar = avatar || null;
    if (normalizedAvatar) {
      const encoded = normalizedAvatar.match(/^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!encoded) throw new BadRequestException('Use a valid WebP profile photo');
      const bytes = Buffer.from(encoded[1], 'base64');
      if (
        bytes.length === 0 ||
        bytes.length > 65_536 ||
        bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WEBP'
      ) {
        throw new BadRequestException('Profile photo must be a valid WebP image under 64 KB');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, businessId },
        select: { id: true, avatar: true },
      });
      if (!user) throw new UnauthorizedException('User not found');
      await tx.user.update({ where: { id: userId }, data: { avatar: normalizedAvatar } });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'UPDATE',
          entityType: 'UserProfile',
          entityId: userId,
          description: normalizedAvatar ? 'Updated profile photo' : 'Removed profile photo',
          beforeData: JSON.stringify({ hasAvatar: Boolean(user.avatar) }),
          afterData: JSON.stringify({ hasAvatar: Boolean(normalizedAvatar) }),
        },
      });
      return { avatar: normalizedAvatar ? `/api/v1/auth/profile/avatar?v=${Date.now()}` : null };
    });
  }

  async register(
    dto: RegisterDto,
    ipAddress = 'unknown',
    userAgent?: string,
  ): Promise<AuthResponseDto & { refreshTokenCookie: string }> {
    this.logger.log(`[AUTH] Register attempt: ${dto.email}`);
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException(`Email ${dto.email} already registered`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            id: uuid(),
            name: dto.businessName,
            businessType: dto.businessType,
            currency: 'TZS',
            taxPercentage: 18,
            allowNegativeStock: false,
            costingMethod: 'FIFO',
          },
        });

        const user = await tx.user.create({
          data: {
            id: uuid(),
            email: normalizedEmail,
            passwordHash: hashedPassword,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            businessId: business.id,
            isActive: true,
          },
        });

        const roles = await this._createDefaultRolesAndPermissions(business.id, tx);
        const ownerRole = roles.find((role) => role.name === 'Owner');
        if (!ownerRole) throw new BadRequestException('Could not create the business owner role');

        await tx.userRole.create({ data: { userId: user.id, roleId: ownerRole.id } });
        const userWithDetails = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
          include: { userRoles: { include: { role: { include: { permissions: true } } } }, permissions: true },
        });
        const sessionId = uuid();
        const tokens = await this._generateTokens(
          user.id,
          user.email,
          business.id,
          userWithDetails,
          sessionId,
        );
        const now = new Date();
        const absoluteExpiresAt = this._sessionAbsoluteExpiry(now);

        await tx.userSession.create({
          data: {
            id: sessionId,
            userId: user.id,
            refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
            ipAddress,
            userAgent,
            expiresAt: this._sessionIdleExpiry(now, absoluteExpiresAt),
            absoluteExpiresAt,
          },
        });

        return {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
          idleTimeoutSeconds: durationSeconds(this.config, 'SESSION_IDLE_TIMEOUT', '30m'),
          refreshTokenCookie: tokens.refreshToken,
          idleExpiresAt: this._sessionIdleExpiry(now, absoluteExpiresAt).toISOString(),
          absoluteExpiresAt: absoluteExpiresAt.toISOString(),
          user: {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: null,
            businessId: business.id,
            businessName: business.name,
            roles: userWithDetails.userRoles.map((userRole) => userRole.role.name),
            permissions: this._permissionKeys(userWithDetails),
          },
        };
      });

      this.logger.log(
        `[AUTH] Registration successful: ${result.user.email} (Business: ${result.user.businessId})`,
      );
      return result;
    } catch (error) {
      if ((error as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException(`Email ${dto.email} already registered`);
      }
      throw error;
    }
  }

  async login(
    dto: LoginDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<AuthResponseDto & { refreshTokenCookie: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    this.logger.log(`[AUTH] Login attempt: ${normalizedEmail}`);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        business: { select: { name: true } },
        userRoles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
        permissions: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`[AUTH] Invalid password for ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Bring older businesses' built-in roles up to date as new permissions ship.
    await this._createDefaultRolesAndPermissions(user.businessId);
    const refreshedUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: { include: { role: { include: { permissions: true } } } },
        permissions: true,
      },
    });
    if (refreshedUser) Object.assign(user, refreshedUser);

    const sessionId = uuid();
    const tokens = await this._generateTokens(
      user.id,
      user.email,
      user.businessId,
      user,
      sessionId,
    );

    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    const now = new Date();
    const absoluteExpiresAt = this._sessionAbsoluteExpiry(now);
    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt: this._sessionIdleExpiry(now, absoluteExpiresAt),
        absoluteExpiresAt,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    this.logger.log(`[AUTH] Login successful: ${user.email}`);

    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      idleTimeoutSeconds: durationSeconds(this.config, 'SESSION_IDLE_TIMEOUT', '30m'),
      refreshTokenCookie: tokens.refreshToken,
      idleExpiresAt: this._sessionIdleExpiry(now, absoluteExpiresAt).toISOString(),
      absoluteExpiresAt: absoluteExpiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar ? '/api/v1/auth/profile/avatar' : null,
        businessId: user.businessId,
        businessName: user.business.name,
        roles: user.userRoles.map((ur) => ur.role.name),
        permissions: this._permissionKeys(user),
      },
    };
  }

  async refreshToken(
    refreshTokenValue: string,
    userId: string,
  ): Promise<Pick<AuthResponseDto, 'accessToken' | 'expiresIn' | 'idleTimeoutSeconds' | 'idleExpiresAt' | 'absoluteExpiresAt'> & { refreshTokenCookie: string }> {
    this.logger.log(`[AUTH] Refresh token attempt for user: ${userId}`);

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshTokenValue, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      if (payload.sub !== userId || payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }
      if (typeof payload.sid !== 'string' || !payload.sid) {
        throw new UnauthorizedException('Refresh token is missing its session binding');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        id: payload.sid,
        expiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      select: { id: true, refreshTokenHash: true, absoluteExpiresAt: true },
    });

    let matchedSession: (typeof sessions)[number] | undefined;
    for (const session of sessions) {
      if (await bcrypt.compare(refreshTokenValue, session.refreshTokenHash)) {
        matchedSession = session;
        break;
      }
    }
    if (!matchedSession)
      throw new UnauthorizedException('Session expired or refresh token already used');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
        permissions: true,
      },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const accessLifetime = durationSeconds(this.config, 'JWT_ACCESS_EXPIRATION', '15m');
    const nowAfterLookup = new Date();
    const absoluteRemaining = Math.floor(
      (matchedSession.absoluteExpiresAt.getTime() - nowAfterLookup.getTime()) / 1000,
    );
    if (absoluteRemaining <= 0)
      throw new UnauthorizedException('Session reached its maximum lifetime');
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        sid: matchedSession.id,
        email: user.email,
        businessId: user.businessId,
        permissions: this._permissionKeys(user),
      },
      { secret: this.config.get('JWT_SECRET'), expiresIn: accessLifetime },
    );
    const refreshLifetime = Math.min(
      durationSeconds(this.config, 'JWT_REFRESH_EXPIRATION', '12h'),
      absoluteRemaining,
    );
    const rotatedRefreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        businessId: user.businessId,
        type: 'refresh',
        sid: matchedSession.id,
      },
      { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: refreshLifetime },
    );
    const refreshTokenHash = await bcrypt.hash(rotatedRefreshToken, 10);
    const idleExpiry = this._sessionIdleExpiry(nowAfterLookup, matchedSession.absoluteExpiresAt);
    const rotated = await this.prisma.$transaction((tx) =>
      tx.userSession.updateMany({
        where: {
          id: matchedSession!.id,
          userId,
          refreshTokenHash: matchedSession!.refreshTokenHash,
          expiresAt: { gt: nowAfterLookup },
          absoluteExpiresAt: { gt: nowAfterLookup },
        },
        data: { refreshTokenHash, expiresAt: idleExpiry },
      }),
    );
    if (rotated.count !== 1) {
      throw new UnauthorizedException(
        'Refresh token already used; sign in again if your session expired',
      );
    }

    this.logger.log(`[AUTH] Token refreshed for user: ${userId}`);

    return {
      accessToken,
      refreshTokenCookie: rotatedRefreshToken,
      expiresIn: accessLifetime,
      idleTimeoutSeconds: durationSeconds(this.config, 'SESSION_IDLE_TIMEOUT', '30m'),
      idleExpiresAt: idleExpiry.toISOString(),
      absoluteExpiresAt: matchedSession.absoluteExpiresAt.toISOString(),
    };
  }

  async validateSession(userId: string, sessionId: string): Promise<boolean> {
    const now = new Date();
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      select: { id: true, expiresAt: true, absoluteExpiresAt: true },
    });
    if (!session) return false;

    const idleTimeoutMs = durationSeconds(this.config, 'SESSION_IDLE_TIMEOUT', '30m') * 1000;
    const touchIntervalMs = Math.min(5 * 60 * 1000, idleTimeoutMs / 3);
    const touchThresholdMs = idleTimeoutMs - touchIntervalMs;
    // Touch at most once per five minutes to keep server-side inactivity enforcement current
    // without writing a database row on every API request.
    if (session.expiresAt.getTime() - now.getTime() < touchThresholdMs) {
      const touched = await this.prisma.userSession.updateMany({
        where: {
          id: session.id,
          userId,
          expiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
        },
        data: { expiresAt: this._sessionIdleExpiry(now, session.absoluteExpiresAt) },
      });
      if (touched.count !== 1) return false;
    }
    return true;
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<PasswordResetRequestDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    this.logger.log('[AUTH] Forgot password request received');

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return {
        message: 'If email exists, password reset link has been sent',
      };
    }

    const resetToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'password-reset',
        jti: uuid(),
      },
      {
        secret: this.config.get('JWT_RESET_SECRET'),
        expiresIn: '1h',
      },
    );

    const tokenHash = await bcrypt.hash(resetToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await this._sendPasswordResetEmail(user.businessId, user.email, user.firstName, resetToken);

    return {
      message: 'If email exists, password reset link has been sent',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    this.logger.log(`[AUTH] Reset password attempt`);

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(dto.token, {
        secret: this.config.get('JWT_RESET_SECRET'),
      });
      if (payload.type !== 'password-reset') {
        throw new UnauthorizedException('Invalid or expired reset token');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isTokenValid = await bcrypt.compare(dto.token, user.passwordResetTokenHash || '');
    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid reset token');
    }

    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new UnauthorizedException('Reset token expired');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.user.updateMany({
        where: {
          id: user.id,
          passwordResetTokenHash: user.passwordResetTokenHash,
          passwordResetExpiresAt: { gt: new Date() },
        },
        data: {
          passwordHash: hashedPassword,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }
      await tx.userSession.deleteMany({ where: { userId: user.id } });
    });

    this.logger.log('[AUTH] Password reset successful');

    return { message: 'Password reset successful' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    this.logger.log(`[AUTH] Change password for user: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const currentPassword = dto.currentPassword || dto.oldPassword;
    if (!currentPassword) {
      throw new BadRequestException('Current/old password is required');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword },
      });
      await tx.userSession.deleteMany({ where: { userId } });
    });

    this.logger.log(`[AUTH] Password changed for user: ${userId}`);

    return { message: 'Password changed successfully. Please login again.' };
  }

  async logout(userId: string, sessionId: string): Promise<{ message: string }> {
    this.logger.log(`[AUTH] Logout for user: ${userId}`);

    await this.prisma.userSession.deleteMany({
      where: { userId, id: sessionId },
    });

    this.logger.log(`[AUTH] Logout successful: ${userId}`);

    return { message: 'Logged out successfully' };
  }

  async listActiveSessions(userId: string, currentSessionId: string) {
    const now = new Date();
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        absoluteExpiresAt: true,
      },
    });
    return sessions.map((session) => ({ ...session, isCurrent: session.id === currentSessionId }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ message: string }> {
    const result = await this.prisma.userSession.deleteMany({ where: { id: sessionId, userId } });
    if (result.count !== 1) throw new UnauthorizedException('Session not found or already ended');
    return { message: 'Session signed out successfully' };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        business: { select: { name: true } },
        userRoles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
        permissions: true,
      },
    });
  }

  private _permissionKeys(user: { userRoles?: Array<{ role: { permissions: Array<{ key: string }> } }>; permissions?: Array<{ key: string }> }): string[] {
    return [...new Set([
      ...(user.userRoles || []).flatMap(({ role }) => role.permissions.map(({ key }) => key)),
      ...(user.permissions || []).map(({ key }) => key),
    ])];
  }

  private async _generateTokens(
    userId: string,
    email: string,
    businessId: string,
    user: any,
    sessionId: string,
  ) {
    const permissions = this._permissionKeys(user);
    const accessLifetime = durationSeconds(this.config, 'JWT_ACCESS_EXPIRATION', '15m');
    const refreshLifetime = durationSeconds(this.config, 'JWT_REFRESH_EXPIRATION', '12h');

    const accessToken = this.jwtService.sign(
      {
        sub: userId,
        sid: sessionId,
        email,
        businessId,
        permissions,
      },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: accessLifetime,
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: userId,
        email,
        businessId,
        type: 'refresh',
        sid: sessionId,
      },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: refreshLifetime,
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: accessLifetime,
    };
  }

  private _sessionAbsoluteExpiry(now: Date): Date {
    return new Date(
      now.getTime() + durationSeconds(this.config, 'SESSION_ABSOLUTE_TIMEOUT', '12h') * 1000,
    );
  }

  private _sessionIdleExpiry(now: Date, absoluteExpiresAt: Date): Date {
    return new Date(
      Math.min(
        now.getTime() + durationSeconds(this.config, 'SESSION_IDLE_TIMEOUT', '30m') * 1000,
        absoluteExpiresAt.getTime(),
      ),
    );
  }

  private async _createDefaultRolesAndPermissions(
    businessId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const existingRoles = await client.role.findMany({
      where: { businessId },
      include: { permissions: { select: { id: true, key: true } } },
    });

    const permissionsData = [
      { key: 'products.view', category: 'Products', action: 'view' },
      { key: 'products.create', category: 'Products', action: 'create' },
      { key: 'products.edit', category: 'Products', action: 'edit' },
      { key: 'products.delete', category: 'Products', action: 'delete' },
      { key: 'suppliers.view', category: 'Suppliers', action: 'view' },
      { key: 'suppliers.create', category: 'Suppliers', action: 'create' },
      { key: 'suppliers.edit', category: 'Suppliers', action: 'edit' },
      { key: 'suppliers.delete', category: 'Suppliers', action: 'delete' },
      { key: 'customers.view', category: 'Customers', action: 'view' },
      { key: 'customers.create', category: 'Customers', action: 'create' },
      { key: 'customers.edit', category: 'Customers', action: 'edit' },
      { key: 'customers.delete', category: 'Customers', action: 'delete' },
      { key: 'purchases.view', category: 'Purchases', action: 'view' },
      { key: 'purchases.create', category: 'Purchases', action: 'create' },
      { key: 'purchases.edit', category: 'Purchases', action: 'edit' },
      { key: 'purchases.approve', category: 'Purchases', action: 'approve' },
      { key: 'purchases.cancel', category: 'Purchases', action: 'cancel' },
      { key: 'sales.view', category: 'Sales', action: 'view' },
      { key: 'sales.create', category: 'Sales', action: 'create' },
      { key: 'sales.edit', category: 'Sales', action: 'edit' },
      { key: 'sales.discount', category: 'Sales', action: 'discount' },
      { key: 'sales.approve', category: 'Sales', action: 'approve' },
      { key: 'sales.cancel', category: 'Sales', action: 'cancel' },
      { key: 'inventory.view', category: 'Inventory', action: 'view' },
      { key: 'inventory.adjust', category: 'Inventory', action: 'adjust' },
      { key: 'inventory.transfer', category: 'Inventory', action: 'transfer' },
      { key: 'payments.view', category: 'Payments', action: 'view' },
      { key: 'payments.create', category: 'Payments', action: 'create' },
      { key: 'expenses.view', category: 'Expenses', action: 'view' },
      { key: 'expenses.create', category: 'Expenses', action: 'create' },
      { key: 'expenses.edit', category: 'Expenses', action: 'edit' },
      { key: 'expenses.delete', category: 'Expenses', action: 'delete' },
      { key: 'expenses.approve', category: 'Expenses', action: 'approve' },
      { key: 'expenses.pay', category: 'Expenses', action: 'pay' },
      { key: 'reports.view', category: 'Reports', action: 'view' },
      { key: 'reports.export', category: 'Reports', action: 'export' },
      { key: 'users.view', category: 'Users', action: 'view' },
      { key: 'users.create', category: 'Users', action: 'create' },
      { key: 'users.edit', category: 'Users', action: 'edit' },
      { key: 'users.delete', category: 'Users', action: 'delete' },
      { key: 'roles.manage', category: 'Roles', action: 'manage' },
      { key: 'settings.view', category: 'Settings', action: 'view' },
      { key: 'settings.edit', category: 'Settings', action: 'edit' },
      { key: 'audit.view', category: 'Audit', action: 'view' },
    ];

    const existingPermissions = await client.permission.findMany({
      where: { businessId },
      select: { id: true, key: true },
    });
    const existingPermissionKeys = new Set(existingPermissions.map((p) => p.key));
    const missingPermissions = permissionsData.filter((p) => !existingPermissionKeys.has(p.key));
    if (missingPermissions.length) {
      await client.permission.createMany({
        data: missingPermissions.map((p) => ({
          id: uuid(),
          businessId,
          key: p.key,
          name: p.key.replace('_', ' ').toUpperCase(),
          category: p.category,
          action: p.action,
        })),
        skipDuplicates: true,
      });
    }
    const supportedPermissionKeys = new Set(permissionsData.map(({ key }) => key));
    const obsoletePermissions = existingPermissions.filter(({ key }) => !supportedPermissionKeys.has(key));
    if (obsoletePermissions.length) {
      const obsoleteIds = obsoletePermissions.map(({ id }) => id);
      const rolesWithObsoletePermissions = await client.role.findMany({
        where: { businessId, permissions: { some: { id: { in: obsoleteIds } } } },
        select: { id: true },
      });
      for (const role of rolesWithObsoletePermissions) {
        const retained = await client.permission.findMany({ where: { businessId, roles: { some: { id: role.id } }, key: { in: [...supportedPermissionKeys] } }, select: { id: true } });
        await client.role.update({ where: { id: role.id }, data: { permissions: { set: retained.map(({ id }) => ({ id })) } } });
        await client.userSession.deleteMany({ where: { user: { userRoles: { some: { roleId: role.id } } } } });
      }
      const usersWithObsoletePermissions = await client.user.findMany({
        where: { businessId, permissions: { some: { id: { in: obsoleteIds } } } },
        select: { id: true },
      });
      for (const user of usersWithObsoletePermissions) {
        const retained = await client.permission.findMany({ where: { businessId, users: { some: { id: user.id } }, key: { in: [...supportedPermissionKeys] } }, select: { id: true } });
        await client.user.update({ where: { id: user.id }, data: { permissions: { set: retained.map(({ id }) => ({ id })) } } });
        await client.userSession.deleteMany({ where: { userId: user.id } });
      }
      await client.permission.deleteMany({ where: { id: { in: obsoleteIds } } });
    }
    const createdPermissions = await client.permission.findMany({ where: { businessId } });
    for (const permission of createdPermissions) {
      const definition = permissionsData.find(({ key }) => key === permission.key);
      if (definition) {
        const title = definition.action.charAt(0).toUpperCase() + definition.action.slice(1);
        const name = `${definition.category} · ${title}`;
        if (permission.name !== name || permission.category !== definition.category || permission.action !== definition.action) {
          await client.permission.update({ where: { id: permission.id }, data: { name, category: definition.category, action: definition.action } });
        }
      }
    }

    const rolesConfig = [
      {
        name: 'Owner',
        description: 'Full access to business operations, settings, team and security controls.',
        isSystem: true,
        permissionKeys: createdPermissions.map((p) => p.key),
      },
      {
        name: 'Admin',
        description: 'Manage workspace operations and roles; Owner assignment and user deletion stay Owner-only.',
        isSystem: true,
        permissionKeys: createdPermissions
          .filter((p) => p.key !== 'users.delete')
          .map((p) => p.key),
      },
      {
        name: 'Manager',
        description: 'Manage daily sales, stock, purchasing, payments, expenses and reports.',
        isSystem: true,
        permissionKeys: [
          'products.view',
          'products.create',
          'products.edit',
          'suppliers.view',
          'suppliers.create',
          'suppliers.edit',
          'customers.view',
          'customers.create',
          'customers.edit',
          'purchases.view',
          'purchases.create',
          'purchases.edit',
          'purchases.approve',
          'purchases.cancel',
          'sales.view',
          'sales.create',
          'sales.edit',
          'sales.discount',
          'sales.approve',
          'sales.cancel',
          'inventory.view',
          'inventory.adjust',
          'inventory.transfer',
          'payments.view',
          'payments.create',
          'expenses.view',
          'expenses.create',
          'expenses.edit',
          'expenses.approve',
          'expenses.pay',
          'reports.view',
          'reports.export',
        ],
      },
      {
        name: 'Salesperson',
        description: 'Create and issue sales, find products and customers, and record customer payments.',
        isSystem: true,
        permissionKeys: [
          'products.view',
          'customers.view',
          'customers.create',
          'sales.view',
          'sales.create',
          'sales.edit',
          'sales.approve',
          'inventory.view',
          'payments.create',
        ],
      },
    ];

    const roles = [];
    for (const roleConfig of rolesConfig) {
      const current = existingRoles.find((role) => role.name === roleConfig.name && role.isSystem);
      const desired = createdPermissions.filter((p) => roleConfig.permissionKeys.includes(p.key));
      const currentPermissionIds = new Set(current?.permissions.map((p) => p.id) || []);
      const missingRolePermissions = desired.filter(
        (permission) => !currentPermissionIds.has(permission.id),
      );
      const obsoleteRolePermissionIds = current?.permissions
        .filter((permission) => !roleConfig.permissionKeys.includes(permission.key))
        .map((permission) => permission.id) ?? [];
      if (current) {
        if (missingRolePermissions.length || obsoleteRolePermissionIds.length || current.description !== roleConfig.description) {
          const permissionsChanged = missingRolePermissions.length > 0 || obsoleteRolePermissionIds.length > 0;
          const updatedRole = await client.role.update({
                where: { id: current.id },
                data: {
                  description: roleConfig.description,
                  permissions: {
                    set: desired.map((permission) => ({ id: permission.id })),
                  },
                },
                include: { permissions: true },
              });
          if (permissionsChanged) {
            await client.userSession.deleteMany({ where: { user: { userRoles: { some: { roleId: current.id } } } } });
          }
          roles.push(updatedRole);
        } else {
          roles.push(current);
        }
      } else {
        roles.push(
          await client.role.create({
            data: {
              id: uuid(),
              businessId,
              name: roleConfig.name,
              isSystem: roleConfig.isSystem,
              permissions: { connect: desired.map((p) => ({ id: p.id })) },
            },
            include: { permissions: true },
          }),
        );
      }
    }

    // Repair custom roles created before permission dependencies were enforced.
    // Keep each role internally complete so its grants still make sense on their own.
    const dependencies: Record<string, string[]> = {
      'products.edit': ['products.view'], 'products.delete': ['products.view'],
      'suppliers.edit': ['suppliers.view'], 'suppliers.delete': ['suppliers.view'],
      'customers.edit': ['customers.view'], 'customers.delete': ['customers.view'],
      'users.edit': ['users.view'], 'users.delete': ['users.view'],
      'purchases.create': ['products.view', 'suppliers.view'],
      'purchases.edit': ['purchases.view'], 'purchases.approve': ['purchases.view'], 'purchases.cancel': ['purchases.view'],
      'sales.create': ['products.view', 'customers.view'],
      'sales.edit': ['sales.view'], 'sales.discount': ['sales.view'], 'sales.approve': ['sales.view'], 'sales.cancel': ['sales.view'],
      'inventory.adjust': ['inventory.view'], 'inventory.transfer': ['inventory.view'],
      'expenses.edit': ['expenses.view'], 'expenses.delete': ['expenses.view'], 'expenses.approve': ['expenses.view'], 'expenses.pay': ['expenses.view'],
      'reports.export': ['reports.view'],
    };
    const normalizeGrants = (keys: string[]) => {
      const normalized = new Set(keys);
      let changed = true;
      while (changed) {
        changed = false;
        for (const [key, required] of Object.entries(dependencies)) {
          if (normalized.has(key) && required.some((dependency) => !normalized.has(dependency))) {
            normalized.delete(key); changed = true;
          }
        }
        if (normalized.has('payments.create') && !['sales.view', 'purchases.view', 'expenses.view'].some((key) => normalized.has(key))) {
          normalized.delete('payments.create'); changed = true;
        }
      }
      return normalized;
    };
    const currentRoles = await client.role.findMany({ where: { businessId }, include: { permissions: { select: { id: true, key: true } } } });
    const permissionIdByKey = new Map(createdPermissions.map(({ id, key }) => [key, id] as const));
    for (const role of currentRoles.filter(({ isSystem }) => !isSystem)) {
      const normalized = normalizeGrants(role.permissions.map(({ key }) => key));
      if (normalized.size !== role.permissions.length) {
        await client.role.update({ where: { id: role.id }, data: { permissions: { set: [...normalized].flatMap((key) => { const id = permissionIdByKey.get(key); return id ? [{ id }] : []; }) } } });
        await client.userSession.deleteMany({ where: { user: { userRoles: { some: { roleId: role.id } } } } });
      }
    }
    const usersWithDirectPermissions = await client.user.findMany({
      where: { businessId, permissions: { some: {} } },
      include: { permissions: { select: { id: true, key: true } }, userRoles: { include: { role: { include: { permissions: { select: { key: true } } } } } } },
    });
    for (const user of usersWithDirectPermissions) {
      const roleKeys = user.userRoles.flatMap(({ role }) => role.permissions.map(({ key }) => key));
      const allowed = normalizeGrants([...roleKeys, ...user.permissions.map(({ key }) => key)]);
      const retainedDirect = user.permissions.filter(({ key }) => allowed.has(key));
      if (retainedDirect.length !== user.permissions.length) {
        await client.user.update({ where: { id: user.id }, data: { permissions: { set: retainedDirect.map(({ id }) => ({ id })) } } });
        await client.userSession.deleteMany({ where: { userId: user.id } });
      }
    }

    this.logger.log(`[AUTH] Default roles & permissions created for business: ${businessId}`);

    return roles;
  }

  private async _sendPasswordResetEmail(
    businessId: string,
    email: string,
    firstName: string,
    resetToken: string,
  ) {
    try {
      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      const resetUrl = new URL('/reset-password', frontendUrl);
      resetUrl.searchParams.set('token', resetToken);
      const queued = await this.notifications.enqueuePasswordResetEmail({
        businessId,
        email,
        firstName,
        resetLink: resetUrl.toString(),
      });
      if (queued) this.logger.log('[AUTH] Password reset email queued');
    } catch {
      // Keep account existence private and do not return or log the reset token.
      this.logger.error('[AUTH] Unable to queue password reset email');
    }
  }
}
