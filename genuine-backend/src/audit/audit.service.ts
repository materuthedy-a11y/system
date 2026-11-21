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

const sensitiveKey =
  /(password|token|secret|api.?key|private.?key|access.?key|signing.?key|encryption.?key|credential|authorization|bearer|cookie|session|refresh.?token|reset.?token|recovery.?code|otp|mfa|hash|salt)/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : redact(child),
    ]),
  );
}

function safeJson(value: string | null) {
  if (!value) return null;
  try {
    return redact(JSON.parse(value));
  } catch {
    return '[Unstructured audit data hidden]';
  }
}

function csvCell(value: unknown) {
  const raw = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  const text = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private async filters(businessId: string, query: AuditQuery) {
    const where: any = {};
    if (query.action?.trim()) where.action = query.action.trim().toUpperCase().slice(0, 60);
    if (query.entityType?.trim())
      where.entityType = { contains: query.entityType.trim().slice(0, 80), mode: 'insensitive' };
    if (query.userId?.trim()) where.userId = query.userId.trim().slice(0, 100);
    const parseDate = (value: string, endOfDay = false) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
      return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
        ? null
        : date;
    };
    const start = query.dateFrom ? parseDate(query.dateFrom) : undefined;
    const end = query.dateTo ? parseDate(query.dateTo, true) : undefined;
    if (query.dateFrom && !start)
      throw new BadRequestException('dateFrom must be a valid YYYY-MM-DD date');
    if (query.dateTo && !end)
      throw new BadRequestException('dateTo must be a valid YYYY-MM-DD date');
    if (start && end && start > end)
      throw new BadRequestException('dateFrom must be on or before dateTo');
    if (start || end)
      where.createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
    const search = query.q?.trim().slice(0, 120);
    if (search) {
      const searchableEvents: any[] = [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        // Managed-user changes keep the target identity and status in these
        // snapshots; include them so searching for the affected user finds the event.
        { beforeData: { contains: search, mode: 'insensitive' } },
        { afterData: { contains: search, mode: 'insensitive' } },
        { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
        { user: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
        { user: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
        { actorName: { contains: search, mode: 'insensitive' } },
        { actorEmail: { contains: search, mode: 'insensitive' } },
      ];
      // Older GRN action events may not have copied the human-readable GRN
      // number into their JSON snapshot. Resolve that number to its record ID
      // so searching the document number still returns its complete timeline.
      if (/GRN/i.test(search)) {
        const matchingGrns = await this.prisma.goodsReceivedNote.findMany({
          where: { businessId, grnNumber: { contains: search, mode: 'insensitive' } },
          select: { id: true },
          take: 100,
        });
        if (matchingGrns.length) {
          searchableEvents.push({
            entityType: 'GoodsReceivedNote',
            entityId: { in: matchingGrns.map((grn) => grn.id) },
          });
        }
      }
      where.OR = searchableEvents;
    }
    return where;
  }

  private present(row: any) {
    return {
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      description: row.description,
      actor:
        row.user || row.actorEmail
          ? {
              id: row.user?.id || null,
              name: row.user
                ? `${row.user.firstName} ${row.user.lastName}`.trim()
                : row.actorName || 'Former user',
              email: row.user?.email || row.actorEmail || '',
            }
          : null,
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
    const where = { businessId, ...(await this.filters(businessId, query)) };
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
    return {
      data: rows.map((row) => this.present(row)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
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
    const where = { businessId, ...(await this.filters(businessId, query)) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10_000,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const heading = [
      'Timestamp (UTC)',
      'Actor',
      'Email',
      'Action',
      'Record type',
      'Record ID',
      'Description',
      'IP address',
      'User agent',
      'Before',
      'After',
    ];
    const lines = rows.map((row) =>
      [
        row.createdAt.toISOString(),
        row.user ? `${row.user.firstName} ${row.user.lastName}`.trim() : row.actorName,
        row.user?.email || row.actorEmail,
        row.action,
        row.entityType,
        row.entityId,
        row.description,
        row.ipAddress,
        row.userAgent,
        safeJson(row.beforeData),
        safeJson(row.afterData),
      ]
        .map(csvCell)
        .join(','),
    );
    const filters = [
      query.dateFrom ? `From: ${query.dateFrom}` : '',
      query.dateTo ? `To: ${query.dateTo}` : '',
      query.action ? `Action: ${query.action}` : '',
      query.entityType ? `Record type: ${query.entityType}` : '',
      query.q ? `Search: ${query.q}` : '',
      query.userId ? `User ID: ${query.userId}` : '',
    ].filter(Boolean);
    const metadata = [
      ['Export summary', 'Value'].map(csvCell).join(','),
      [csvCell('Matching events'), csvCell(total)].join(','),
      [csvCell('Exported events'), csvCell(rows.length)].join(','),
      [csvCell('Truncated'), csvCell(total > rows.length ? 'Yes — newest 10,000 only' : 'No')].join(
        ',',
      ),
      ...(filters.length
        ? [[csvCell('Applied filters'), csvCell(filters.join(' | '))].join(',')]
        : []),
      '',
    ];
    return [...metadata, heading.map(csvCell).join(','), ...lines].join('\r\n');
  }

  async exportPdf(businessId: string, query: AuditQuery) {
    const where = { businessId, ...(await this.filters(businessId, query)) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10_000,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const width = 595.28;
    const height = 841.89;
    const margin = 42;
    const contentWidth = width - margin * 2;
    const pages: string[][] = [[]];
    let commands = pages[0];
    let y = height - 48;
    const safe = (value: unknown) =>
      (value == null ? '—' : typeof value === 'string' ? value : JSON.stringify(value))
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[·•]/g, ' / ')
        .replace(/[–—]/g, '-')
        .replace(/[^\x20-\x7E]/g, '');
    const escaped = (value: string) => value.replace(/([\\()])/g, '\\$1');
    const drawText = (
      value: string,
      x: number,
      baseline: number,
      size = 10,
      color = '0.15 0.18 0.15',
    ) => {
      commands.push(
        `${color} rg BT /F1 ${size} Tf ${x.toFixed(1)} ${baseline.toFixed(1)} Td (${escaped(value)}) Tj ET`,
      );
    };
    const drawRect = (x: number, top: number, w: number, h: number, color: string) => {
      commands.push(
        `${color} rg ${x.toFixed(1)} ${(top - h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`,
      );
    };
    const wrap = (value: unknown, maxChars: number) => {
      const output: string[] = [];
      let line = '';
      for (const word of safe(value).split(/\s+/)) {
        const chunks = word.match(new RegExp(`.{1,${Math.max(4, maxChars)}}`, 'g')) || [''];
        for (const chunk of chunks) {
          if (line && `${line} ${chunk}`.length > maxChars) {
            output.push(line);
            line = chunk;
          } else line = line ? `${line} ${chunk}` : chunk;
        }
      }
      if (line || output.length === 0) output.push(line);
      return output;
    };
    const newPage = () => {
      pages.push([]);
      commands = pages[pages.length - 1];
      y = height - 42;
    };
    const drawBanner = () => {
      drawRect(0, height, width, 7, '0.00 0.52 0.39');
      drawText(
        'MIZANIA  |  SECURITY AND BUSINESS HISTORY',
        margin,
        height - 34,
        8,
        '0.00 0.42 0.32',
      );
      drawText('Audit log', margin, height - 58, 22, '0.10 0.13 0.11');
      drawText(
        `Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
        margin,
        height - 76,
        9,
        '0.38 0.42 0.38',
      );
      drawText(
        `${total.toLocaleString('en-US')} matching events${total > rows.length ? ` · showing newest ${rows.length.toLocaleString('en-US')}` : ''}`,
        margin,
        height - 91,
        9,
        '0.38 0.42 0.38',
      );
      y = height - 112;
    };
    drawBanner();
    if (total > rows.length) {
      drawRect(margin, y + 9, contentWidth, 27, '0.99 0.95 0.86');
      drawText(
        `This PDF contains the newest ${rows.length.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} matching events. Narrow the date range to export the rest.`,
        margin + 8,
        y - 8,
        9,
        '0.42 0.29 0.05',
      );
      y -= 37;
    }
    const filterSummary = [
      query.dateFrom ? `From ${query.dateFrom}` : '',
      query.dateTo ? `To ${query.dateTo}` : '',
      query.action ? `Action ${query.action}` : '',
      query.entityType ? `Record ${query.entityType}` : '',
      query.q ? `Search ${query.q}` : '',
      query.userId ? `User ${query.userId}` : '',
    ]
      .filter(Boolean)
      .join('  |  ');
    if (filterSummary) {
      drawText(`Filters: ${wrap(filterSummary, 95).join(' ')}`, margin, y, 9, '0.28 0.32 0.28');
      y -= 18;
    }
    if (rows.length === 0) drawText('No audit events match these filters.', margin, y - 8, 11);
    rows.forEach((row, index) => {
      const actor = row.user
        ? `${row.user.firstName} ${row.user.lastName}`.trim()
        : row.actorName || 'Former user';
      const email = row.user?.email || row.actorEmail || '';
      const titleLines = wrap(`${row.action}  |  ${row.entityType}`, 74);
      const metaLines = wrap(
        `${row.createdAt.toISOString()} UTC  |  ${actor}${email ? ` · ${email}` : ''}`,
        94,
      );
      const recordLines = wrap(
        `Record: ${row.entityId || '—'}${row.ipAddress ? `  |  IP: ${row.ipAddress}` : ''}`,
        94,
      );
      const before = safe(safeJson(row.beforeData));
      const after = safe(safeJson(row.afterData));
      const maxDetail = 900;
      const clipped = (value: unknown, max: number) => {
        const text = safe(value);
        return text.length > max
          ? `${text.slice(0, max)} [PDF shortened; see CSV for full value]`
          : text;
      };
      const details = [
        ...wrap(clipped(row.description || 'No description recorded.', 1200), 88).map(
          (line) => `Details: ${line}`,
        ),
        ...wrap(
          `Before: ${before.length > maxDetail ? `${before.slice(0, maxDetail)} [PDF text shortened; see CSV for full value]` : before}`,
          88,
        ),
        ...wrap(
          `After: ${after.length > maxDetail ? `${after.slice(0, maxDetail)} [PDF text shortened; see CSV for full value]` : after}`,
          88,
        ),
        ...(row.userAgent ? wrap(`Device: ${clipped(row.userAgent, 300)}`, 88) : []),
      ];
      const titleHeight = Math.max(20, titleLines.length * 13 + 8);
      const blockHeight =
        titleHeight + metaLines.length * 11 + recordLines.length * 11 + details.length * 12 + 12;
      if (y - blockHeight < 38) {
        newPage();
        drawBanner();
      }
      drawRect(margin, y + 8, contentWidth, titleHeight, '0.90 0.96 0.93');
      titleLines.forEach((line, lineIndex) =>
        drawText(line, margin + 8, y - 5 - lineIndex * 13, 11, '0.00 0.38 0.29'),
      );
      y -= titleHeight + 2;
      metaLines.forEach((line) => {
        drawText(line, margin + 6, y, 8.5, '0.34 0.37 0.34');
        y -= 11;
      });
      recordLines.forEach((line) => {
        drawText(line, margin + 6, y, 8.5, '0.34 0.37 0.34');
        y -= 11;
      });
      details.forEach((line) => {
        drawText(line, margin + 6, y, 8.5);
        y -= 12;
      });
      y -= 8;
      if (index < rows.length - 1) {
        commands.push(
          `0.83 0.87 0.83 RG 0.5 w ${margin} ${y + 4} m ${width - margin} ${y + 4} l S`,
        );
      }
    });
    const objects: string[] = [];
    const addObject = (value: string) => {
      objects.push(value);
      return objects.length;
    };
    const catalogId = addObject('');
    const pagesId = addObject('');
    const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');
    const pageIds: number[] = [];
    pages.forEach((pageCommands, index) => {
      pageCommands.push(
        `0.42 0.45 0.40 rg BT /F1 8 Tf ${width - margin - 55} 20 Td (Page ${index + 1} of ${pages.length}) Tj ET`,
      );
      const stream = pageCommands.join('\n');
      const streamId = addObject(
        `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
      );
      pageIds.push(
        addObject(
          `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`,
        ),
      );
    });
    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] =
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf, 'ascii'));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, 'ascii');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'ascii');
  }
}
