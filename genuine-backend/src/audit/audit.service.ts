import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface AuditQuery {
  page?: string;
  limit?: string;
  q?: string;
  action?: string;
  entityType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const sensitiveKey = /(password|token|secret|api.?key|credential|authorization|cookie|refresh.?token|reset.?token|hash)/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, sensitiveKey.test(key) ? '[REDACTED]' : redact(child)]));
}

function safeJson(value: string | null) {
  if (!value) return null;
  try { return redact(JSON.parse(value)); }
  catch { return '[Unstructured audit data hidden]'; }
}

function csvCell(value: unknown) {
  const raw = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  const text = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private filters(query: AuditQuery) {
    const where: any = {};
    if (query.action?.trim()) where.action = query.action.trim().toUpperCase().slice(0, 60);
    if (query.entityType?.trim()) where.entityType = { contains: query.entityType.trim().slice(0, 80), mode: 'insensitive' };
    if (query.userId?.trim()) where.userId = query.userId.trim().slice(0, 100);
    const parseDate = (value: string, endOfDay = false) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
      return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
    };
    const start = query.dateFrom ? parseDate(query.dateFrom) : undefined;
    const end = query.dateTo ? parseDate(query.dateTo, true) : undefined;
    if (query.dateFrom && !start) throw new BadRequestException('dateFrom must be a valid YYYY-MM-DD date');
    if (query.dateTo && !end) throw new BadRequestException('dateTo must be a valid YYYY-MM-DD date');
    if (start && end && start > end) throw new BadRequestException('dateFrom must be on or before dateTo');
    if (start || end) where.createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
    const search = query.q?.trim().slice(0, 120);
    if (search) where.OR = [
      { action: { contains: search, mode: 'insensitive' } },
      { entityType: { contains: search, mode: 'insensitive' } },
      { entityId: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
      { user: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
      { user: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
      { actorName: { contains: search, mode: 'insensitive' } },
      { actorEmail: { contains: search, mode: 'insensitive' } },
    ];
    return where;
  }

  private present(row: any) {
    return {
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      description: row.description,
      actor: row.user || row.actorEmail ? {
        id: row.user?.id || null,
        name: row.user ? `${row.user.firstName} ${row.user.lastName}`.trim() : row.actorName || 'Former user',
        email: row.user?.email || row.actorEmail || '',
      } : null,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      beforeData: safeJson(row.beforeData),
      afterData: safeJson(row.afterData),
      createdAt: row.createdAt,
    };
  }

  async list(businessId: string, query: AuditQuery) {
    const page = Math.max(1, Math.min(1_000_000, Number.parseInt(query.page || '1', 10) || 1));
    const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit || '25', 10) || 25));
    const where = { businessId, ...this.filters(query) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: rows.map((row) => this.present(row)), page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async getOne(businessId: string, id: string) {
    const row = await this.prisma.auditLog.findFirst({
      where: { id, businessId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    if (!row) throw new NotFoundException('Audit event not found');
    return this.present(row);
  }

  async exportCsv(businessId: string, query: AuditQuery) {
    const rows = await this.prisma.auditLog.findMany({
      where: { businessId, ...this.filters(query) },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10_000,
    });
    const heading = ['Timestamp (UTC)', 'Actor', 'Email', 'Action', 'Record type', 'Record ID', 'Description', 'IP address', 'Before', 'After'];
    const lines = rows.map((row) => [
      row.createdAt.toISOString(),
      row.user ? `${row.user.firstName} ${row.user.lastName}`.trim() : row.actorName,
      row.user?.email || row.actorEmail,
      row.action,
      row.entityType,
      row.entityId,
      row.description,
      row.ipAddress,
      safeJson(row.beforeData),
      safeJson(row.afterData),
    ].map(csvCell).join(','));
    return [heading.map(csvCell).join(','), ...lines].join('\r\n');
  }
}
