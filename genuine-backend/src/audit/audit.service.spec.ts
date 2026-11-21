import { AuditService } from './audit.service';

describe('AuditService PDF export', () => {
  const row = {
    id: 'audit-1',
    action: 'UPDATE',
    entityType: 'BusinessSettings',
    entityId: 'record-1',
    description: 'Changed the business contact details.',
    actorName: 'Admin User',
    actorEmail: 'admin@example.test',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    beforeData: JSON.stringify({
      businessName: 'Old name',
      password: 'do-not-export',
      privateKey: 'do-not-export-private',
    }),
    afterData: JSON.stringify({ businessName: 'New name', accessToken: 'do-not-export-either' }),
    createdAt: new Date('2026-11-15T09:30:00.000Z'),
    user: null,
  };

  function createService(total = 1) {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(total),
      },
      $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    };
    return { service: new AuditService(prisma as any), prisma };
  }

  it('creates a readable PDF and redacts credential values', async () => {
    const { service } = createService();
    const pdf = await service.exportPdf('business-a', {
      dateFrom: '2026-11-01',
      dateTo: '2026-11-15',
    });
    const content = pdf.toString('ascii');

    expect(content.startsWith('%PDF-1.4')).toBe(true);
    expect(content).toContain('/BaseFont /Times-Roman');
    expect(content).toContain('Audit log');
    expect(content).toContain('Changed the business contact details.');
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain('do-not-export');
    expect(content).not.toContain('do-not-export-private');
    expect(content).toContain('Page 1 of 1');
  });

  it('states clearly when the PDF is capped and invites a narrower date range', async () => {
    const { service } = createService(10_001);
    const pdf = await service.exportPdf('business-a', {});
    const content = pdf.toString('ascii');
    expect(content).toContain('newest 1 of 10,001 matching events');
    expect(content).toContain('Narrow the date range to export the rest.');
  });

  it('puts the date range and truncation count in the CSV so capped exports are not silent', async () => {
    const { service } = createService(10_001);
    const csv = await service.exportCsv('business-a', {
      dateFrom: '2026-11-01',
      dateTo: '2026-11-15',
    });
    expect(csv).toContain('Export summary');
    expect(csv).toContain('10001');
    expect(csv).toContain('newest 10,000 only');
    expect(csv).toContain('From: 2026-11-01 | To: 2026-11-15');
    expect(csv).toContain('Timestamp (UTC)');
    expect(csv).not.toContain('do-not-export');
  });
});
