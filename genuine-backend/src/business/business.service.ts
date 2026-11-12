import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  BusinessSetupDto,
  UpdateBusinessProfileDto,
  BusinessProfileResponseDto,
  CreateLocationDto,
  UpdateLocationDto,
  LocationResponseDto,
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  UpdateBusinessSettingsDto,
  TaxRateDto,
  CreateExchangeRateDto,
  ConvertCurrencyDto,
  PaymentMethodResponseDto,
  CreateExpenseCategoryDto,
  ExpenseCategoryResponseDto,
  UnitResponseDto,
  BusinessSetupResponseDto,
  CreateManagedUserDto,
  UpdateManagedUserDto,
  ResetManagedUserPasswordDto,
  CreateRoleDto,
  UpdateRoleDto,
} from './dto';

function assertSupportedCurrency(currency: string) {
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency }).format(1);
  } catch {
    throw new BadRequestException('Enter a supported three-letter ISO currency code');
  }
}

@Injectable()
export class BusinessService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private logger: LoggerService,
  ) {}

  async listManagedUsers(businessId: string, roleId?: string, status?: string) {
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) throw new BadRequestException('Status must be ACTIVE or INACTIVE');
    if (roleId) {
      const role = await this.prisma.role.findFirst({ where: { id: roleId, businessId } });
      if (!role) throw new NotFoundException('Role not found');
    }
    const users = await this.prisma.user.findMany({
      where: { businessId, ...(status ? { isActive: status === 'ACTIVE' } : {}), ...(roleId ? { userRoles: { some: { roleId } } } : {}) },
      include: { userRoles: { include: { role: { select: { id: true, name: true } } } } },
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }, { lastName: 'asc' }],
    });
    return users.map((user) => ({
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      phone: user.phone, isActive: user.isActive, status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      roles: user.userRoles.map(({ role }) => ({ id: role.id, name: role.name })),
      roleId: user.userRoles[0]?.role.id ?? null, roleName: user.userRoles.map(({ role }) => role.name).join(', ') || 'No role',
      createdAt: user.createdAt, lastLogin: user.lastLogin,
    }));
  }

  async createManagedUser(businessId: string, actorId: string, dto: CreateManagedUserDto) {
    const email = dto.email.trim().toLowerCase();
    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, businessId } });
    if (!role) throw new BadRequestException('Choose a role from this business');
    await this.assertRoleDelegable(businessId, actorId, role.id);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('This email address is already registered');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: {
          id: uuid(), businessId, email, passwordHash, firstName: dto.firstName.trim(), lastName: dto.lastName.trim(),
          phone: dto.phone?.trim() || null, isActive: true,
        } });
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
        await tx.auditLog.create({ data: { businessId, userId: actorId, entityType: 'User', entityId: user.id, action: 'CREATE', afterData: JSON.stringify({ id: user.id, email, firstName: user.firstName, lastName: user.lastName, roleId: role.id }), description: 'CREATE managed user' } });
        return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, isActive: user.isActive, status: 'ACTIVE', roleId: role.id, roleName: role.name, roles: [{ id: role.id, name: role.name }], createdAt: user.createdAt, lastLogin: user.lastLogin };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('This email address is already registered');
      throw error;
    }
  }

  async updateManagedUser(businessId: string, actorId: string, id: string, dto: UpdateManagedUserDto) {
    const before = await this.prisma.user.findFirst({ where: { id, businessId }, include: { userRoles: { include: { role: true } } } });
    if (!before) throw new NotFoundException('User not found');
    const actorIsOwner = await this.isBusinessOwner(businessId, actorId);
    if (before.userRoles.some(({ role }) => role.name === 'Owner' && role.isSystem) && !actorIsOwner) {
      throw new ForbiddenException('Only an Owner can manage the Owner account');
    }
    if (actorId === id && dto.isActive === false) throw new BadRequestException('You cannot deactivate your own account');
    const nextRole = dto.roleId ? await this.prisma.role.findFirst({ where: { id: dto.roleId, businessId } }) : null;
    if (dto.roleId && !nextRole) throw new BadRequestException('Choose a role from this business');
    if (nextRole) await this.assertRoleDelegable(businessId, actorId, nextRole.id);
    const hadOwnerRole = before.userRoles.some(({ role }) => role.name === 'Owner');
    const removesOwner = hadOwnerRole && (dto.isActive === false || (nextRole && nextRole.name !== 'Owner'));
    const normalizedEmail = dto.email?.trim().toLowerCase();
    if (normalizedEmail) {
      const duplicate = await this.prisma.user.findFirst({ where: { email: normalizedEmail, id: { not: id } } });
      if (duplicate) throw new ConflictException('This email address is already registered');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (removesOwner) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`owner-count:${businessId}`}, 0)) IS NULL AS locked`;
        const activeOwners = await tx.user.count({ where: { businessId, isActive: true, userRoles: { some: { role: { name: 'Owner', businessId } } } } });
        if (activeOwners <= 1) throw new BadRequestException('The business must keep at least one active Owner');
      }
      const user = await tx.user.update({ where: { id }, data: {
        ...(normalizedEmail !== undefined && { email: normalizedEmail }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      } });
      if (nextRole) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.create({ data: { userId: id, roleId: nextRole.id } });
        await tx.userSession.deleteMany({ where: { userId: id } });
      }
      if (dto.isActive === false || normalizedEmail !== undefined) await tx.userSession.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({ data: { businessId, userId: actorId, entityType: 'User', entityId: id, action: 'UPDATE', beforeData: JSON.stringify({ id, email: before.email, isActive: before.isActive, roles: before.userRoles.map(({ role }) => role.name) }), afterData: JSON.stringify({ id, email: user.email, isActive: user.isActive, role: nextRole?.name }), description: 'UPDATE managed user' } });
      return user;
    });
    const assignedRole = nextRole ?? before.userRoles[0]?.role;
    return { id: updated.id, email: updated.email, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone, isActive: updated.isActive, status: updated.isActive ? 'ACTIVE' : 'INACTIVE', roles: assignedRole ? [{ id: assignedRole.id, name: assignedRole.name }] : [], roleId: assignedRole?.id ?? null, roleName: assignedRole?.name ?? 'No role', createdAt: updated.createdAt, lastLogin: updated.lastLogin };
  }

  async deactivateManagedUser(businessId: string, actorId: string, id: string) {
    return this.updateManagedUser(businessId, actorId, id, { isActive: false });
  }

  async resetManagedUserPassword(businessId: string, actorId: string, id: string, dto: ResetManagedUserPasswordDto) {
    const user = await this.prisma.user.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null } });
      await tx.userSession.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({ data: { businessId, userId: actorId, entityType: 'User', entityId: id, action: 'PASSWORD_RESET', description: 'ADMIN reset managed user password' } });
    });
    return { message: 'Password updated; the user must sign in again.' };
  }

  async listRoles(businessId: string, actorId: string) {
    const roles = await this.prisma.role.findMany({ where: { businessId }, include: { permissions: { select: { key: true } }, _count: { select: { userRoles: true } } }, orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] });
    const actor = await this.prisma.user.findFirst({
      where: { id: actorId, businessId, isActive: true },
      include: { userRoles: { include: { role: { include: { permissions: { select: { key: true } } } } } }, permissions: { select: { key: true } } },
    });
    if (!actor) throw new ForbiddenException('Your account cannot view team roles');
    const actorPermissionKeys = new Set([...actor.userRoles.flatMap(({ role }) => role.permissions.map(({ key }) => key)), ...actor.permissions.map(({ key }) => key)]);
    const canManage = actorPermissionKeys.has('roles.manage');
    const isOwner = actor.userRoles.some(({ role }) => role.name === 'Owner' && role.isSystem);
    return roles
      .filter((role) => (isOwner || role.name !== 'Owner') && (canManage || role.permissions.every(({ key }) => actorPermissionKeys.has(key))))
      .map(({ permissions, _count, ...role }) => ({
        ...role,
        // Only role managers need the grant matrix; user managers receive safe assignment options.
        permissions: canManage ? permissions.map(({ key }) => key) : [],
        usersCount: _count.userRoles,
        ...((role.name === 'Owner' && isOwner) ? { permissions: permissions.map(({ key }) => key) } : {}),
      }));
  }

  async listPermissions(businessId: string) {
    return this.prisma.permission.findMany({ where: { businessId }, orderBy: [{ category: 'asc' }, { name: 'asc' }], select: { id: true, key: true, name: true, description: true, category: true, action: true } });
  }

  private assertPermissionDependencies(permissionKeys: string[]) {
    const granted = new Set(permissionKeys);
    const allOf: Record<string, string[]> = {
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
      'audit.export': ['audit.view'],
    };
    const missing = new Set<string>();
    for (const [permission, dependencies] of Object.entries(allOf)) {
      if (granted.has(permission)) for (const dependency of dependencies) if (!granted.has(dependency)) missing.add(dependency);
    }
    if (granted.has('payments.create') && !['sales.view', 'purchases.view', 'expenses.view'].some((key) => granted.has(key))) {
      missing.add('sales.view or purchases.view or expenses.view');
    }
    if (missing.size) throw new BadRequestException(`These permissions need their related view access: ${[...missing].join(', ')}`);
  }

  async createRole(businessId: string, actorId: string, dto: CreateRoleDto) {
    const name = dto.name.trim();
    if (['owner', 'admin', 'manager', 'salesperson'].includes(name.toLowerCase())) throw new BadRequestException('That name is reserved for a built-in role. Please choose a different name for your custom role.');
    const permissions = await this.prisma.permission.findMany({ where: { businessId, key: { in: [...new Set(dto.permissions)] } } });
    if (permissions.length !== new Set(dto.permissions).size) throw new BadRequestException('One or more permissions are not available in this business');
    this.assertPermissionDependencies(permissions.map(({ key }) => key));
    await this.assertPermissionsDelegable(businessId, actorId, permissions.map(({ key }) => key));
    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.create({ data: { id: uuid(), businessId, name, description: dto.description?.trim() || null, isSystem: false, permissions: { connect: permissions.map(({ id }) => ({ id })) } }, include: { permissions: { select: { key: true } } } });
        await tx.auditLog.create({ data: { businessId, userId: actorId, entityType: 'Role', entityId: role.id, action: 'CREATE', afterData: JSON.stringify(role), description: 'CREATE role' } });
        return { ...role, permissions: role.permissions.map(({ key }) => key), usersCount: 0 };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A role with this name already exists');
      throw error;
    }
  }

  async updateRole(businessId: string, actorId: string, id: string, dto: UpdateRoleDto) {
    const before = await this.prisma.role.findFirst({ where: { id, businessId }, include: { permissions: { select: { id: true } } } });
    if (!before) throw new NotFoundException('Role not found');
    if (before.isSystem) throw new BadRequestException('System roles are protected and cannot be edited');
    let permissionIds: string[] | undefined;
    if (dto.permissions) {
      const permissions = await this.prisma.permission.findMany({ where: { businessId, key: { in: [...new Set(dto.permissions)] } }, select: { id: true } });
      if (permissions.length !== new Set(dto.permissions).size) throw new BadRequestException('One or more permissions are not available in this business');
      this.assertPermissionDependencies(dto.permissions);
      await this.assertPermissionsDelegable(businessId, actorId, dto.permissions);
      permissionIds = permissions.map(({ id: permissionId }) => permissionId);
    }
    const name = dto.name?.trim();
    if (name && ['owner', 'admin', 'manager', 'salesperson'].includes(name.toLowerCase())) throw new BadRequestException('That name is reserved for a built-in role. Please choose a different name for your custom role.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (permissionIds) await tx.role.update({ where: { id }, data: { permissions: { set: permissionIds.map((permissionId) => ({ id: permissionId })) } } });
        const role = await tx.role.update({ where: { id }, data: { ...(name && { name }), ...(dto.description !== undefined && { description: dto.description.trim() || null }) }, include: { permissions: { select: { key: true } }, _count: { select: { userRoles: true } } } });
        await tx.auditLog.create({ data: { businessId, userId: actorId, entityType: 'Role', entityId: id, action: 'UPDATE', beforeData: JSON.stringify(before), afterData: JSON.stringify(role), description: 'UPDATE role' } });
        if (permissionIds) {
          const assigned = await tx.userRole.findMany({ where: { roleId: id }, select: { userId: true } });
          if (assigned.length) await tx.userSession.deleteMany({ where: { userId: { in: assigned.map(({ userId }) => userId) } } });
        }
        return { ...role, permissions: role.permissions.map(({ key }) => key), usersCount: role._count.userRoles };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A role with this name already exists');
      throw error;
    }
  }

  private async isBusinessOwner(businessId: string, userId: string): Promise<boolean> {
    const assignment = await this.prisma.userRole.findFirst({
      where: { userId, role: { businessId, name: 'Owner', isSystem: true } },
      select: { userId: true },
    });
    return Boolean(assignment);
  }

  private async assertRoleDelegable(businessId: string, actorId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, businessId },
      include: { permissions: { select: { key: true } } },
    });
    if (!role) throw new BadRequestException('Choose a role from this business');
    if (role.name === 'Owner' && role.isSystem && !(await this.isBusinessOwner(businessId, actorId))) {
      throw new ForbiddenException('Only an Owner can assign the Owner role');
    }
    await this.assertPermissionsDelegable(businessId, actorId, role.permissions.map(({ key }) => key));
  }

  private async assertPermissionsDelegable(businessId: string, actorId: string, requested: string[]) {
    if (await this.isBusinessOwner(businessId, actorId)) return;
    const actor = await this.prisma.user.findFirst({
      where: { id: actorId, businessId, isActive: true },
      include: { userRoles: { include: { role: { include: { permissions: { select: { key: true } } } } } }, permissions: { select: { key: true } } },
    });
    if (!actor) throw new ForbiddenException('Your account cannot delegate permissions');
    const available = new Set([...actor.userRoles.flatMap(({ role }) => role.permissions.map(({ key }) => key)), ...actor.permissions.map(({ key }) => key)]);
    const denied = requested.filter((key) => !available.has(key));
    if (denied.length) throw new ForbiddenException(`You cannot grant permissions you do not hold: ${denied.join(', ')}`);
  }

  async deleteRole(businessId: string, actorId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, businessId }, include: { _count: { select: { userRoles: true } } } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    if (role._count.userRoles) throw new BadRequestException('Reassign users before deleting this role');
    await this.prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id } });
      await tx.auditLog.create({ data: { businessId, userId: actorId, entityType: 'Role', entityId: id, action: 'DELETE', beforeData: JSON.stringify(role), description: 'DELETE role' } });
    });
    return { message: 'Role deleted successfully' };
  }

  async getBusinessSettings(businessId: string) {
    const settings = await this.prisma.businessSettings.findUnique({ where: { businessId } });
    return settings ?? {
      businessId,
      defaultLocationId: null,
      defaultPaymentMethodId: null,
      invoicePrefix: 'INV', poPrefix: 'PO', grnPrefix: 'GRN', receiptPrefix: 'PAY',
      dateFormat: 'DD/MM/YYYY', timeFormat: '24', weekStartsOn: 'MONDAY',
      lowStockThreshold: 0, theme: 'SYSTEM',
    };
  }

  async updateBusinessSettings(businessId: string, userId: string, dto: UpdateBusinessSettingsDto) {
    const before = await this.prisma.businessSettings.findUnique({ where: { businessId } });
    if (dto.defaultLocationId) {
      const location = await this.prisma.location.findFirst({ where: { id: dto.defaultLocationId, businessId, isActive: true } });
      if (!location) throw new BadRequestException('Select an active location belonging to this business');
    }
    if (dto.defaultPaymentMethodId) {
      const method = await this.prisma.paymentMethod.findFirst({ where: { id: dto.defaultPaymentMethodId, businessId, isActive: true } });
      if (!method) throw new BadRequestException('Select an active payment method belonging to this business');
    }
    const settings = await this.prisma.$transaction(async (tx) => {
      const row = await tx.businessSettings.upsert({
        where: { businessId },
        create: { businessId, ...dto },
        update: dto,
      });
      await tx.auditLog.create({
        data: { businessId, userId, entityType: 'BusinessSettings', entityId: row.id, action: before ? 'UPDATE' : 'CREATE', beforeData: before ? JSON.stringify(before) : undefined, afterData: JSON.stringify(row), description: 'SAVE general settings' },
      });
      return row;
    });
    return settings;
  }

  async listTaxRates(businessId: string) {
    return this.prisma.taxRate.findMany({ where: { businessId }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  }

  async listExchangeRates(businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
    if (!business) throw new NotFoundException('Business not found');
    const rates = await this.prisma.businessExchangeRate.findMany({
      where: { businessId, baseCurrency: business.currency },
      orderBy: [{ currencyCode: 'asc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
    return { baseCurrency: business.currency, rates };
  }

  async createExchangeRate(businessId: string, userId: string, dto: CreateExchangeRateDto) {
    assertSupportedCurrency(dto.currencyCode);
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
    if (!business) throw new NotFoundException('Business not found');
    if (dto.currencyCode === business.currency) throw new BadRequestException('Choose a currency different from the business base currency');
    const effectiveFrom = new Date(`${dto.effectiveFrom.slice(0, 10)}T00:00:00.000Z`);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.businessExchangeRate.create({
          data: {
            businessId,
            baseCurrency: business.currency,
            currencyCode: dto.currencyCode,
            rateToBase: dto.rateToBase,
            effectiveFrom,
            note: dto.note?.trim() || null,
            createdBy: userId,
          },
        });
        await tx.auditLog.create({
          data: {
            businessId,
            userId,
            entityType: 'BusinessExchangeRate',
            entityId: row.id,
            action: 'CREATE',
            afterData: JSON.stringify(row),
            description: `CREATE exchange rate 1 ${row.currencyCode} = ${row.rateToBase} ${row.baseCurrency}`,
          },
        });
        return row;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A rate for this currency and effective date already exists. Add a new effective date to change it without altering history.');
      }
      throw error;
    }
  }

  async convertCurrency(businessId: string, dto: ConvertCurrencyDto) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
    if (!business) throw new NotFoundException('Business not found');
    if (dto.currencyCode === business.currency) {
      return { amount: dto.amount, result: dto.amount, currencyCode: dto.currencyCode, baseCurrency: business.currency, rateToBase: 1, effectiveFrom: dto.asOf.slice(0, 10), direction: dto.direction };
    }
    const asOf = new Date(`${dto.asOf.slice(0, 10)}T23:59:59.999Z`);
    const rate = await this.prisma.businessExchangeRate.findFirst({
      where: { businessId, baseCurrency: business.currency, currencyCode: dto.currencyCode, effectiveFrom: { lte: asOf } },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
    if (!rate) throw new NotFoundException(`No ${dto.currencyCode} exchange rate is configured for ${dto.asOf.slice(0, 10)}`);
    const converted = dto.direction === 'TO_BASE' ? dto.amount * rate.rateToBase : dto.amount / rate.rateToBase;
    const result = Math.round((converted + Number.EPSILON) * 100) / 100;
    return {
      amount: dto.amount,
      result,
      currencyCode: dto.direction === 'TO_BASE' ? business.currency : dto.currencyCode,
      baseCurrency: business.currency,
      rateToBase: rate.rateToBase,
      effectiveFrom: rate.effectiveFrom.toISOString().slice(0, 10),
      direction: dto.direction,
    };
  }

  async createTaxRate(businessId: string, userId: string, dto: TaxRateDto) {
    if (!dto.name?.trim() || !dto.code?.trim() || dto.rate == null) throw new BadRequestException('Tax name, code and rate are required');
    if (dto.isDefault && dto.isActive === false) throw new BadRequestException('An inactive tax rate cannot be the default');
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault && (dto.appliesTo || 'BOTH') !== 'PURCHASES') {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`default-tax:${businessId}:SALES`}, 0)) IS NULL AS locked`;
        await tx.taxRate.updateMany({ where: { businessId, isDefault: true }, data: { isDefault: false } });
        await tx.business.update({ where: { id: businessId }, data: { taxPercentage: dto.rate } });
      }
      const row = await tx.taxRate.create({ data: { businessId, name, code, rate: dto.rate, description: dto.description?.trim() || null, appliesTo: dto.appliesTo || 'BOTH', isDefault: dto.isDefault ?? false, isActive: dto.isActive ?? true } });
      await tx.auditLog.create({ data: { businessId, userId, entityType: 'TaxRate', entityId: row.id, action: 'CREATE', afterData: JSON.stringify(row), description: 'CREATE TaxRate' } });
      return row;
    }).catch((error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new ConflictException('Tax name or code already exists');
      throw error;
    });
  }

  async updateTaxRate(businessId: string, userId: string, id: string, dto: TaxRateDto) {
    const before = await this.prisma.taxRate.findFirst({ where: { id, businessId } });
    if (!before) throw new NotFoundException('Tax rate not found');
    if (dto.isDefault && dto.isActive === false) throw new BadRequestException('An inactive tax rate cannot be the default');
    if (before.isDefault && dto.isActive === false) throw new ConflictException('Choose another default tax rate before deactivating this one');
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        const scope = dto.appliesTo ?? before.appliesTo;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`default-tax:${businessId}:${scope === 'PURCHASES' ? 'PURCHASES' : 'SALES'}`}, 0)) IS NULL AS locked`;
        await tx.taxRate.updateMany({ where: { businessId, id: { not: id }, isDefault: true }, data: { isDefault: false } });
        if (dto.rate === undefined && before.appliesTo !== 'PURCHASES') await tx.business.update({ where: { id: businessId }, data: { taxPercentage: before.rate } });
      }
      const row = await tx.taxRate.update({ where: { id }, data: { ...(dto.name !== undefined && { name: dto.name.trim() }), ...(dto.code !== undefined && { code: dto.code.trim().toUpperCase() }), ...(dto.rate !== undefined && { rate: dto.rate }), ...(dto.description !== undefined && { description: dto.description.trim() || null }), ...(dto.appliesTo !== undefined && { appliesTo: dto.appliesTo }), ...(dto.isActive !== undefined && { isActive: dto.isActive }), ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }) } });
      if (row.isDefault && row.isActive && row.appliesTo !== 'PURCHASES') await tx.business.update({ where: { id: businessId }, data: { taxPercentage: row.rate } });
      await tx.auditLog.create({ data: { businessId, userId, entityType: 'TaxRate', entityId: id, action: 'UPDATE', beforeData: JSON.stringify(before), afterData: JSON.stringify(row), description: 'UPDATE TaxRate' } });
      return row;
    });
  }

  async deleteTaxRate(businessId: string, userId: string, id: string) {
    const before = await this.prisma.taxRate.findFirst({ where: { id, businessId } });
    if (!before) throw new NotFoundException('Tax rate not found');
    if (before.isDefault) throw new ConflictException('Choose another default tax rate before deactivating this one');
    const row = await this.prisma.taxRate.update({ where: { id }, data: { isActive: false } });
    await this.prisma.auditLog.create({ data: { businessId, userId, entityType: 'TaxRate', entityId: id, action: 'DEACTIVATE', beforeData: JSON.stringify(before), afterData: JSON.stringify(row), description: 'DEACTIVATE TaxRate' } });
    return { message: 'Tax rate deactivated' };
  }

  async setupBusiness(
    businessId: string,
    userId: string,
    dto: BusinessSetupDto,
  ): Promise<BusinessSetupResponseDto> {
    this.logger.log(`[BUSINESS] Setup initiated for business: ${businessId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.businessId !== businessId) {
      throw new ForbiddenException('Not authorized to setup this business');
    }

    const isOwner = user.userRoles.some(
      (ur) => ur.role.name === 'Owner' || ur.role.name === 'Admin',
    );
    if (!isOwner) {
      throw new ForbiddenException('Only Owner/Admin can setup business');
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (business.isSetupComplete) {
      throw new BadRequestException('Business is already setup');
    }

    const updatedBusiness = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        name: dto.businessName,
        description: dto.businessDescription,
        businessType: dto.businessType,
        currency: dto.currency,
        taxPercentage: dto.taxPercentage,
        costingMethod: dto.costingMethod,
        allowNegativeStock: dto.allowNegativeStock,
      },
    });

    let locationsCreated = 0;
    let paymentMethodsCreated = 0;
    let expenseCategoriesCreated = 0;
    let unitsCreated = 0;

    if (dto.locations && dto.locations.length > 0) {
      for (const loc of dto.locations) {
        const existingLocation = await this.prisma.location.findFirst({
          where: {
            businessId,
            code: loc.code,
          },
        });

        if (!existingLocation) {
          await this.prisma.location.create({
            data: {
              id: uuid(),
              businessId,
              name: loc.name,
              code: loc.code,
              type: loc.type,
              description: loc.description,
              managerId: userId,
              isActive: true,
            },
          });
          locationsCreated++;
        }
      }
    } else {
      await this.prisma.location.create({
        data: {
          id: uuid(),
          businessId,
          name: 'Main Warehouse',
          code: 'MAIN',
          type: 'WAREHOUSE',
          managerId: userId,
          isActive: true,
        },
      });
      locationsCreated = 1;
    }

    const defaultPaymentMethods = [
      'Cash',
      'Bank Transfer',
      'Cheque',
      'M-Pesa',
      'Tigo',
      'Airtel',
      'Credit',
    ];

    const paymentMethodsToCreate = dto.paymentMethods || defaultPaymentMethods;

    for (const method of paymentMethodsToCreate) {
      const existing = await this.prisma.paymentMethod.findFirst({
        where: {
          businessId,
          name: method,
        },
      });

      if (!existing) {
        await this.prisma.paymentMethod.create({
          data: {
            id: uuid(),
            businessId,
            name: method,
            isActive: true,
          },
        });
        paymentMethodsCreated++;
      }
    }

    const defaultExpenseCategories = [
      'Salary',
      'Transport',
      'Fuel',
      'Electricity',
      'Water',
      'Rent',
      'Internet',
      'Maintenance',
      'Marketing',
      'Insurance',
      'Tax',
      'Bank Charges',
      'Miscellaneous',
    ];

    const categoriesToCreate = dto.expenseCategories || defaultExpenseCategories;

    for (const category of categoriesToCreate) {
      const existing = await this.prisma.expenseCategory.findFirst({
        where: {
          businessId,
          name: category,
        },
      });

      if (!existing) {
        await this.prisma.expenseCategory.create({
          data: {
            id: uuid(),
            businessId,
            name: category,
            code: category
              .normalize('NFKD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '')
              .slice(0, 32),
            isActive: true,
          },
        });
        expenseCategoriesCreated++;
      }
    }

    const defaultUnits = [
      { name: 'Piece', symbol: 'Pcs' },
      { name: 'Bottle', symbol: 'Btl' },
      { name: 'Carton', symbol: 'Ctn' },
      { name: 'Kilogram', symbol: 'Kg' },
      { name: 'Litre', symbol: 'L' },
      { name: 'Dozen', symbol: 'Dz' },
      { name: 'Meter', symbol: 'M' },
      { name: 'Set', symbol: 'Set' },
      { name: 'Pair', symbol: 'Pr' },
      { name: 'Gram', symbol: 'G' },
      { name: 'Millilitre', symbol: 'Ml' },
    ];

    for (const unit of defaultUnits) {
      const existing = await this.prisma.unit.findFirst({
        where: {
          name: unit.name,
        },
      });

      if (!existing) {
        await this.prisma.unit.create({
          data: {
            id: uuid(),
            name: unit.name,
            symbol: unit.symbol,
            isActive: true,
          },
        });
        unitsCreated++;
      }
    }

    const roles = await this.prisma.role.findMany({
      where: { businessId },
    });

    const permissions = await this.prisma.permission.findMany();

    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        isSetupComplete: true,
      },
    });

    this.logger.log(
      `[BUSINESS] Setup complete for business: ${businessId} (${locationsCreated} locations, ${paymentMethodsCreated} payment methods, ${expenseCategoriesCreated} expense categories)`,
    );

    return {
      message: 'Business setup completed successfully',
      business: {
        id: updatedBusiness.id,
        name: updatedBusiness.name,
        businessType: updatedBusiness.businessType,
        currency: updatedBusiness.currency,
        taxPercentage: updatedBusiness.taxPercentage,
        costingMethod: updatedBusiness.costingMethod,
        allowNegativeStock: updatedBusiness.allowNegativeStock,
        requireApprovalForDiscounts: false,
        requireApprovalForReturns: false,
        isSetupComplete: updatedBusiness.isSetupComplete,
      },
      locationsCreated,
      paymentMethodsCreated,
      expenseCategoriesCreated,
      unitsCreated,
      rolesCreated: roles.length,
      permissionsCreated: permissions.length,
    };
  }

  async getBusinessProfile(businessId: string): Promise<BusinessProfileResponseDto> {
    this.logger.log(`[BUSINESS] Fetching profile for business: ${businessId}`);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return {
      id: business.id,
      name: business.name,
      businessType: business.businessType,
      description: business.description,
      email: business.email,
      phone: business.phone,
      phone2: business.phone2,
      legalName: business.legalName,
      registrationNumber: business.registrationNumber,
      address: business.address,
      city: business.city,
      region: business.region,
      country: business.country,
      taxId: business.taxId,
      timezone: business.timezone,
      language: business.language,
      website: business.website,
      logoUrl: business.logoUrl,
      financialYear: business.financialYear,
      currency: business.currency,
      taxPercentage: business.taxPercentage,
      allowNegativeStock: business.allowNegativeStock,
      requireApprovalForDiscounts: false,
      requireApprovalForReturns: false,
      costingMethod: business.costingMethod,
      isSetupComplete: business.isSetupComplete,
      isActive: business.isActive,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  async getBusinessBrand(businessId: string): Promise<{ name: string; logoUrl: string | null }> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, logoUrl: true },
    });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async updateBusinessProfile(
    businessId: string,
    userId: string,
    dto: UpdateBusinessProfileDto,
  ): Promise<BusinessProfileResponseDto> {
    this.logger.log(`[BUSINESS] Updating profile for business: ${businessId}`);
    if (dto.currency) assertSupportedCurrency(dto.currency);

    if (dto.logoUrl) {
      if (dto.logoUrl.startsWith('data:')) {
        const encoded = dto.logoUrl.match(/^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/);
        const bytes = encoded ? Buffer.from(encoded[1], 'base64') : Buffer.alloc(0);
        if (
          !encoded || bytes.length === 0 || bytes.length > 65_536 ||
          bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' ||
          bytes.toString('ascii', 8, 12) !== 'WEBP'
        ) {
          throw new BadRequestException('Business logo must be a valid WebP image under 64 KB');
        }
      } else {
        let logoUrl: URL;
        try { logoUrl = new URL(dto.logoUrl); }
        catch { throw new BadRequestException('Business logo URL must be a valid HTTPS URL'); }
        if (logoUrl.protocol !== 'https:' || !logoUrl.hostname) {
          throw new BadRequestException('Business logo URL must be a valid HTTPS URL');
        }
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.businessId !== businessId) {
      throw new ForbiddenException('Not authorized to update this business');
    }

    const before = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!before) throw new NotFoundException('Business not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.currency && dto.currency !== before.currency) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`business-currency:${businessId}`}, 0)) IS NULL AS locked`;
        const [products, sales, purchases, payments, expenses, salesReturns, purchaseReturns, customerBalances, supplierBalances, exchangeRates, stockMovements, stockAdjustments, stockTransfers, physicalCounts, financialSummaries, accountingPeriods] = await Promise.all([
          tx.product.count({ where: { businessId } }),
          tx.salesInvoice.count({ where: { businessId } }),
          tx.purchaseOrder.count({ where: { businessId } }),
          tx.payment.count({ where: { businessId } }),
          tx.expense.count({ where: { businessId } }),
          tx.salesReturn.count({ where: { businessId } }),
          tx.purchaseReturn.count({ where: { businessId } }),
          tx.customer.count({ where: { businessId, OR: [{ openingBalance: { not: 0 } }, { creditLimit: { not: 0 } }] } }),
          tx.supplier.count({ where: { businessId, OR: [{ openingBalance: { not: 0 } }, { creditLimit: { not: 0 } }] } }),
          tx.businessExchangeRate.count({ where: { businessId } }),
          tx.inventoryMovement.count({ where: { businessId } }),
          tx.stockAdjustment.count({ where: { businessId } }),
          tx.stockTransfer.count({ where: { businessId } }),
          tx.physicalCount.count({ where: { businessId } }),
          tx.financialSummary.count({ where: { businessId } }),
          tx.accountingPeriod.count({ where: { businessId } }),
        ]);
        if (products || sales || purchases || payments || expenses || salesReturns || purchaseReturns || customerBalances || supplierBalances || exchangeRates || stockMovements || stockAdjustments || stockTransfers || physicalCounts || financialSummaries || accountingPeriods) {
          throw new ConflictException('Business base currency cannot be changed after products, balances, stock activity, exchange rates or financial records exist. Existing amounts are not converted. Keep the original currency or create a new business workspace.');
        }
      }
      if (dto.taxPercentage !== undefined) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`default-tax:${businessId}:SALES`}, 0)) IS NULL AS locked`;
      }
      const salesDefaultRatesBefore = dto.taxPercentage === undefined
        ? []
        : await tx.taxRate.findMany({
            where: { businessId, isActive: true, isDefault: true, appliesTo: { in: ['SALES', 'BOTH'] } },
          });
      const row = await tx.business.update({
        where: { id: businessId },
        data: {
        ...((dto.name || dto.businessName) && { name: dto.name || dto.businessName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.phone2 !== undefined && { phone2: dto.phone2 }),
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.registrationNumber !== undefined && { registrationNumber: dto.registrationNumber }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...((dto.description !== undefined || dto.businessDescription !== undefined) && {
          description: dto.description ?? dto.businessDescription,
        }),
        ...(dto.businessType !== undefined && { businessType: dto.businessType.trim() }),
        ...(dto.website !== undefined && { website: dto.website.trim() || null }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl?.trim() || null }),
        ...(dto.financialYear !== undefined && { financialYear: dto.financialYear }),
        ...(dto.taxPercentage !== undefined && { taxPercentage: dto.taxPercentage }),
        ...(dto.allowNegativeStock !== undefined && {
          allowNegativeStock: dto.allowNegativeStock,
        }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.costingMethod && { costingMethod: dto.costingMethod }),
      },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          entityType: 'Business',
          entityId: businessId,
          action: 'UPDATE',
          beforeData: JSON.stringify(before),
          afterData: JSON.stringify(row),
          description: 'UPDATE Business settings',
        },
      });
      if (dto.taxPercentage !== undefined && salesDefaultRatesBefore.length) {
        await tx.taxRate.updateMany({
          where: { businessId, isActive: true, isDefault: true, appliesTo: { in: ['SALES', 'BOTH'] } },
          data: { rate: dto.taxPercentage },
        });
        for (const beforeRate of salesDefaultRatesBefore) {
          const afterRate = { ...beforeRate, rate: dto.taxPercentage };
          await tx.auditLog.create({
            data: {
              businessId,
              userId,
              entityType: 'TaxRate',
              entityId: beforeRate.id,
              action: 'UPDATE',
              beforeData: JSON.stringify(beforeRate),
              afterData: JSON.stringify(afterRate),
              description: 'SYNC default sales tax rate from General settings',
            },
          });
        }
      }
      return row;
    });

    this.logger.log(`[BUSINESS] Profile updated for business: ${businessId}`);

    return {
      id: updated.id,
      name: updated.name,
      businessType: updated.businessType,
      description: updated.description,
      email: updated.email,
      phone: updated.phone,
      phone2: updated.phone2,
      legalName: updated.legalName,
      registrationNumber: updated.registrationNumber,
      address: updated.address,
      city: updated.city,
      region: updated.region,
      country: updated.country,
      taxId: updated.taxId,
      timezone: updated.timezone,
      language: updated.language,
      website: updated.website,
      logoUrl: updated.logoUrl,
      financialYear: updated.financialYear,
      currency: updated.currency,
      taxPercentage: updated.taxPercentage,
      allowNegativeStock: updated.allowNegativeStock,
      requireApprovalForDiscounts: false,
      requireApprovalForReturns: false,
      costingMethod: updated.costingMethod,
      isSetupComplete: updated.isSetupComplete,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async createLocation(
    businessId: string,
    userId: string,
    dto: CreateLocationDto,
  ): Promise<LocationResponseDto> {
    this.logger.log(`[BUSINESS] Creating location for business: ${businessId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.businessId !== businessId) {
      throw new ForbiddenException('Not authorized');
    }

    const code = dto.code || `LOC_${Date.now().toString().slice(-6)}`;
    const type = dto.type || 'WAREHOUSE';

    const existing = await this.prisma.location.findFirst({
      where: {
        businessId,
        code,
      },
    });

    if (existing) {
      throw new ConflictException(`Location with code ${code} already exists`);
    }

    const location = await this.prisma.location.create({
      data: {
        id: uuid(),
        businessId,
        name: dto.name,
        code,
        type,
        address: dto.address,
        description: dto.description,
        managerId: userId,
        isActive: true,
      },
    });

    return {
      id: location.id,
      businessId: location.businessId,
      name: location.name,
      code: location.code,
      type: location.type,
      address: location.address,
      description: location.description,
      isActive: location.isActive,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    };
  }

  async getLocations(businessId: string, includeInactive = false): Promise<LocationResponseDto[]> {
    const locations = await this.prisma.location.findMany({
      where: { businessId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { createdAt: 'desc' },
    });

    return locations.map((loc) => ({
      id: loc.id,
      businessId: loc.businessId,
      name: loc.name,
      code: loc.code,
      type: loc.type,
      address: loc.address,
      description: loc.description,
      isActive: loc.isActive,
      createdAt: loc.createdAt,
      updatedAt: loc.updatedAt,
    }));
  }

  async getLocationOptions(businessId: string) {
    return this.prisma.location.findMany({
      where: { businessId, isActive: true },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      select: { id: true, name: true, code: true, type: true, isActive: true },
    });
  }

  async updateLocation(
    businessId: string,
    locationId: string,
    userId: string,
    dto: UpdateLocationDto,
  ): Promise<LocationResponseDto> {
    this.logger.log(`[BUSINESS] Updating location: ${locationId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.businessId !== businessId) {
      throw new ForbiddenException('Not authorized');
    }

    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        businessId,
      },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    if (dto.code && dto.code !== location.code) {
      const existing = await this.prisma.location.findFirst({
        where: {
          businessId,
          code: dto.code,
        },
      });

      if (existing) {
        throw new ConflictException(`Location with code ${dto.code} already exists`);
      }
    }

    const updated = await this.prisma.location.update({
      where: { id: locationId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.code && { code: dto.code }),
        ...(dto.type && { type: dto.type }),
        ...(dto.address !== undefined && { address: dto.address || null }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        businessId,
        userId,
        entityType: 'Location',
        entityId: locationId,
        action: 'UPDATE',
        beforeData: JSON.stringify(location),
        afterData: JSON.stringify(updated),
        description: 'UPDATE Location settings',
      },
    });

    return {
      id: updated.id,
      businessId: updated.businessId,
      name: updated.name,
      code: updated.code,
      type: updated.type,
      address: updated.address,
      description: updated.description,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async createPaymentMethod(
    businessId: string,
    userId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    this.logger.log(`[BUSINESS] Creating payment method for business: ${businessId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.businessId !== businessId) {
      throw new ForbiddenException('Not authorized');
    }

    const existing = await this.prisma.paymentMethod.findFirst({
      where: {
        businessId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(`Payment method ${dto.name} already exists`);
    }

    const method = await this.prisma.$transaction(async (tx) => {
      const created = await tx.paymentMethod.create({
        data: {
          id: uuid(),
          businessId,
          name: dto.name.trim(),
          description: dto.description?.trim() || dto.provider?.trim() || null,
          code: dto.code?.trim().toUpperCase() || null,
          methodType: dto.methodType || 'CUSTOM',
          requiresReference: dto.requiresReference ?? false,
          bankDetails: dto.bankDetails?.trim() || null,
          isActive: dto.isActive ?? true,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          entityType: 'PaymentMethod',
          entityId: created.id,
          action: 'CREATE',
          afterData: JSON.stringify(created),
          description: 'CREATE PaymentMethod',
        },
      });
      return created;
    });

    return {
      id: method.id,
      businessId: method.businessId,
      name: method.name,
      description: method.description,
      code: method.code,
      methodType: method.methodType,
      requiresReference: method.requiresReference,
      bankDetails: method.bankDetails,
      isActive: method.isActive,
      createdAt: method.createdAt,
    };
  }

  async getPaymentMethods(businessId: string, includeInactive = false): Promise<PaymentMethodResponseDto[]> {
    const methods = await this.prisma.paymentMethod.findMany({
      where: { businessId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { createdAt: 'desc' },
    });

    return methods.map((m) => ({
      id: m.id,
      businessId: m.businessId,
      name: m.name,
      description: m.description,
      code: m.code,
      methodType: m.methodType,
      requiresReference: m.requiresReference,
      bankDetails: m.bankDetails,
      isActive: m.isActive,
      createdAt: m.createdAt,
    }));
  }

  async updatePaymentMethod(
    businessId: string,
    userId: string,
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, businessId }, select: { id: true } });
    if (!user) throw new ForbiddenException('Not authorized');
    const existing = await this.prisma.paymentMethod.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Payment method not found');
    const name = dto.name?.trim();
    if (name && name !== existing.name) {
      const duplicate = await this.prisma.paymentMethod.findFirst({ where: { businessId, name } });
      if (duplicate) throw new ConflictException(`Payment method ${name} already exists`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.paymentMethod.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(dto.description !== undefined && { description: dto.description.trim() || null }),
          ...(dto.code !== undefined && { code: dto.code.trim().toUpperCase() || null }),
          ...(dto.methodType !== undefined && { methodType: dto.methodType }),
          ...(dto.requiresReference !== undefined && { requiresReference: dto.requiresReference }),
          ...(dto.bankDetails !== undefined && { bankDetails: dto.bankDetails.trim() || null }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          entityType: 'PaymentMethod',
          entityId: id,
          action: 'UPDATE',
          beforeData: JSON.stringify(existing),
          afterData: JSON.stringify(row),
          description: 'UPDATE PaymentMethod settings',
        },
      });
      return row;
    });
    return {
      id: updated.id,
      businessId: updated.businessId,
      name: updated.name,
      description: updated.description,
      code: updated.code,
      methodType: updated.methodType,
      requiresReference: updated.requiresReference,
      bankDetails: updated.bankDetails,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  async createExpenseCategory(
    businessId: string,
    userId: string,
    dto: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategoryResponseDto> {
    this.logger.log(`[BUSINESS] Creating expense category for business: ${businessId}`);

    const cleanName = dto.name?.trim();
    if (!cleanName) throw new BadRequestException('Category name is required');
    if ((dto.budgetLimit == null) !== (dto.budgetPeriod == null)) {
      throw new BadRequestException('budgetLimit and budgetPeriod must be configured together');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.businessId !== businessId) {
      throw new ForbiddenException('Not authorized');
    }

    const categoryCode = (dto.code || cleanName)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32);
    if (!categoryCode)
      throw new BadRequestException('Category code must contain letters or numbers');
    let category;
    try {
      category = await this.prisma.$transaction(async (tx) => {
        const created = await tx.expenseCategory.create({
          data: {
            id: uuid(),
            businessId,
            name: cleanName,
            code: categoryCode,
            description: dto.description,
            budgetLimit: dto.budgetLimit,
            budgetPeriod: dto.budgetPeriod,
            isActive: true,
          },
        });
        await tx.auditLog.create({
          data: {
            businessId,
            userId,
            entityType: 'ExpenseCategory',
            entityId: created.id,
            action: 'CREATE',
            afterData: JSON.stringify(created),
            description: 'CREATE ExpenseCategory',
          },
        });
        return created;
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException(
          'Expense category name or code already exists in this business',
        );
      }
      throw error;
    }

    return {
      id: category.id,
      businessId: category.businessId,
      name: category.name,
      code: category.code,
      description: category.description,
      budgetLimit: category.budgetLimit,
      budgetPeriod: category.budgetPeriod as ExpenseCategoryResponseDto['budgetPeriod'],
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async getExpenseCategories(businessId: string, includeInactive = false): Promise<ExpenseCategoryResponseDto[]> {
    const categories = await this.prisma.expenseCategory.findMany({
      where: { businessId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { createdAt: 'desc' },
    });

    return categories.map((c) => ({
      id: c.id,
      businessId: c.businessId,
      name: c.name,
      code: c.code,
      description: c.description,
      budgetLimit: c.budgetLimit,
      budgetPeriod: c.budgetPeriod as ExpenseCategoryResponseDto['budgetPeriod'],
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async getUnits(businessId: string): Promise<UnitResponseDto[]> {
    const units = await this.prisma.unit.findMany({
      where: { isActive: true, OR: [{ businessId: null }, { businessId }] },
      orderBy: { createdAt: 'asc' },
    });

    return units.map((u) => ({
      id: u.id,
      businessId: u.businessId,
      name: u.name,
      symbol: u.symbol,
      description: u.description,
      baseUnit: u.baseUnit,
      conversionFactor: u.conversionFactor,
      isSystem: u.isSystem || u.businessId === null,
      isActive: u.isActive,
    }));
  }

  async getSetupStatus(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const [locations, paymentMethods, expenseCategories, units] = await Promise.all([
      this.prisma.location.count({ where: { businessId, isActive: true } }),
      this.prisma.paymentMethod.count({ where: { businessId, isActive: true } }),
      this.prisma.expenseCategory.count({ where: { businessId, isActive: true } }),
      this.prisma.unit.count({
        where: { isActive: true, OR: [{ businessId: null }, { businessId }] },
      }),
    ]);

    return {
      isSetupComplete: business.isSetupComplete,
      locationsConfigured: locations,
      paymentMethodsConfigured: paymentMethods,
      expenseCategoriesConfigured: expenseCategories,
      unitsAvailable: units,
      setupStep: business.isSetupComplete ? 'COMPLETE' : 'PENDING',
    };
  }
}
