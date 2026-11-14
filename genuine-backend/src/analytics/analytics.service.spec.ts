import { AnalyticsService } from './analytics.service';
import { inflateRawSync } from 'node:zlib';

describe('AnalyticsService product performance', () => {
  it('allocates invoice-level discounts before subtracting accepted product returns', async () => {
    const productA = {
      id: 'product-a',
      name: 'Product A',
      sku: 'A',
      categoryId: 'category-a',
      category: { name: 'Drinks' },
      buyingPrice: 10,
    };
    const productB = {
      id: 'product-b',
      name: 'Product B',
      sku: 'B',
      categoryId: 'category-b',
      category: { name: 'Snacks' },
      buyingPrice: 5,
    };
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'business-a', currency: 'TZS' }) },
      salesInvoice: {
        findMany: jest.fn().mockResolvedValue([{
          discountAmount: 10,
          items: [
            { quantity: 2, total: 60, product: productA },
            { quantity: 1, total: 40, product: productB },
          ],
        }]),
      },
      salesReturn: {
        findMany: jest.fn().mockResolvedValue([{
          items: [{ productId: 'product-a', quantity: 1, total: 5 }],
        }]),
      },
      inventoryMovement: { findMany: jest.fn().mockResolvedValue([]) },
      stockBalance: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([productA]) },
    };
    const service = new AnalyticsService(prisma as any, {} as any, {} as any);

    const result = await service.getProductPerformance('business-a', {
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      page: 1,
      limit: 20,
      sortBy: 'REVENUE',
    } as any);

    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: 'product-a', revenue: 49, quantity: 1 }),
      expect.objectContaining({ productId: 'product-b', revenue: 36, quantity: 1 }),
    ]));
    expect(result.data.reduce((sum, product) => sum + product.revenue, 0)).toBe(85);
  });
});

describe('AnalyticsService sales dashboard', () => {
  it('deducts a customer return once from both total revenue and top-customer revenue', async () => {
    const invoice = {
      id: 'invoice-a',
      customerId: 'customer-a',
      issuedDate: new Date('2026-10-05T00:00:00.000Z'),
      totalAmount: 100,
      customer: { id: 'customer-a', name: 'Customer A' },
      items: [],
    };
    const returned = {
      id: 'return-a',
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      totalAmount: 10,
      returnDate: new Date('2026-10-06T00:00:00.000Z'),
      items: [],
      invoice: { customerId: invoice.customerId, customer: invoice.customer },
    };
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'business-a', currency: 'TZS' }) },
      accountingPeriod: { findFirst: jest.fn() },
      salesInvoice: { findMany: jest.fn().mockResolvedValue([invoice]) },
      salesReturn: {
        findMany: jest.fn()
          .mockResolvedValueOnce([returned])
          .mockResolvedValueOnce([returned]),
      },
      payment: { findMany: jest.fn().mockResolvedValue([{ invoiceId: invoice.id, amount: 120 }]) },
    };
    const service = new AnalyticsService(prisma as any, {} as any, {} as any);

    const result = await service.getSalesDashboard('business-a', {
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
    } as any);

    expect(result.metrics.revenue).toBe(90);
    expect(result.metrics.outstandingAmount).toBe(0);
    expect(result.metrics.customerCreditAmount).toBe(30);
    expect(result.metrics.unpaidInvoiceCount).toBe(0);
    expect(result.topCustomers).toEqual([
      expect.objectContaining({ customerId: 'customer-a', revenue: 90, invoiceCount: 1 }),
    ]);
  });
});

describe('AnalyticsService PDF export', () => {
  const service = new AnalyticsService({} as any, {} as any, {} as any);
  const salesReport = (customerNames: string[]) => ({
    period: '2026-11-01 to 2026-11-03',
    currency: 'TZS',
    metrics: {
      invoiceCount: 7,
      revenue: 17700,
      quantitySold: 5,
      averageOrderValue: 2528.57,
      paidAmount: 5310,
      outstandingAmount: 14160,
      customerCreditAmount: 1770,
      unpaidInvoiceCount: 4,
    },
    topCustomers: customerNames.map((customerName, index) => ({
      customerId: `customer-${index}-long-internal-id`,
      customerName,
      revenue: index === 0 ? 14160 : 3540,
      invoiceCount: index === 0 ? 6 : 1,
    })),
  });

  it('keeps sales summaries readable and fits short customer tables on one page', () => {
    const pdf = (service as any).toPdf(
      salesReport(['Customer Alpha', 'Customer Beta']),
      'SALES_DASHBOARD',
    ).toString('ascii');

    expect(pdf).toContain('/BaseFont /Times-Roman');
    expect(pdf).toContain('/F1 12 Tf');
    expect(pdf).toContain('Metrics / Invoice Count');
    expect(pdf).toContain('(17,700) Tj');
    expect(pdf).not.toContain('Metrics ? Invoice Count');
    expect(pdf).not.toContain('Customer Id');
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(1);
  });

  it('keeps a short customer table together instead of orphaning its final row', () => {
    const pdf = (service as any).toPdf(
      salesReport(['Customer Alpha', 'Customer Beta', 'Customer Gamma']),
      'SALES_DASHBOARD',
    ).toString('ascii');
    const pageOneFooter = pdf.indexOf('(Page 1 of 2)');
    const pageTwoFooter = pdf.indexOf('(Page 2 of 2)');

    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(pdf.indexOf('Customer Alpha')).toBeGreaterThan(pageOneFooter);
    expect(pdf.indexOf('Customer Gamma')).toBeGreaterThan(pageOneFooter);
    expect(pdf.indexOf('Customer Gamma')).toBeLessThan(pageTwoFooter);
  });

  it('exports visible executive report data without internal duplicate KPI rows', () => {
    const dashboard = {
      period: '2026-11-01 to 2026-11-14',
      currency: 'TZS',
      summary: {
        totalRevenue: { label: 'Total Revenue', value: 21240, unit: 'TZS', trend: 'UP', status: 'GOOD' },
        totalProfit: { label: 'Net Profit', value: 9240, unit: 'TZS', trend: 'UP', status: 'GOOD' },
      },
      kpis: [{ name: 'Total Revenue', label: 'Total Revenue', value: 21240, unit: 'TZS', formula: 'Long duplicate KPI formula' }],
      charts: {
        periods: ['2026-11-01', '2026-11-02'],
        revenueVsExpenses: [
          { label: 'Revenue', data: [0, 21240] },
          { label: 'Expenses', data: [0, 0] },
        ],
        topProducts: { labels: ['Test Product'], revenue: [16776], quantity: [6] },
      },
      definitions: { revenue: 'Issued invoice totals less accepted customer returns.' },
    };

    const pdf = (service as any).toPdf(dashboard, 'DASHBOARD').toString('ascii');

    expect(pdf).toContain('Key figures');
    expect(pdf).toContain('(Executive Overview) Tj');
    expect(pdf).toContain('Top Products');
    expect(pdf).toContain('Test Product');
    expect(pdf).toContain('Revenue) Tj');
    expect(pdf).toContain('Expenses) Tj');
    expect(pdf).not.toContain('{\\"label\\":');
    expect(pdf).not.toContain('KPI Details');
    expect(pdf).not.toContain('Long duplicate KPI');
    expect(pdf.match(/\/Type \/Page /g)!.length).toBeLessThanOrEqual(2);
  });

  it('retains each nested executive chart series in export sections', () => {
    const report = {
      charts: {
        periods: ['2026-11-01', '2026-11-02'],
        revenueVsExpenses: [
          { label: 'Revenue', data: [100, 200] },
          { label: 'Expenses', data: [10, 20] },
        ],
        topProducts: { labels: ['Product A'], revenue: [150], quantity: [3] },
        salesTrend: { labels: ['2026-11-01'], values: [100] },
        cashFlow: { labels: ['2026-11-01'], inflows: [100], outflows: [20], netFlow: [80] },
        customerMetrics: { labels: ['Customer A'], revenue: [100], transactions: [2] },
      },
    };
    const sections = (service as any).exportSections(report) as Array<{
      title: string;
      headers: string[];
      rows: Array<Record<string, unknown>>;
    }>;

    expect(sections.map((section) => section.title)).toEqual(expect.arrayContaining([
      'Charts', 'Charts top Products', 'Charts sales Trend', 'Charts cash Flow', 'Charts customer Metrics',
    ]));
    expect(sections.find((section) => section.title === 'Charts')?.rows).toEqual([
      { Period: '2026-11-01', Revenue: 100, Expenses: 10 },
      { Period: '2026-11-02', Revenue: 200, Expenses: 20 },
    ]);
    expect(sections.find((section) => section.title === 'Charts top Products')?.rows).toEqual([
      { Period: 'Product A', Revenue: 150, Quantity: 3 },
    ]);
  });

  it('includes the Sales page channel breakdown and revenue trend in each export format', async () => {
    const range = {
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-03T23:59:59.999Z'),
      periodName: '2026-11-01 to 2026-11-03',
      weekStartsOn: 'MONDAY',
    };
    jest.spyOn(service as any, 'getDateRange').mockResolvedValue(range);
    jest.spyOn(service, 'getSalesDashboard').mockResolvedValue({
      period: range.periodName,
      currency: 'TZS',
      metrics: {
        invoiceCount: 7,
        revenue: 17700,
        quantitySold: 5,
        averageOrderValue: 2528.57,
        paidAmount: 5310,
        outstandingAmount: 14160,
        customerCreditAmount: 1770,
        unpaidInvoiceCount: 4,
      },
      topCustomers: [{ customerId: 'customer-a', customerName: 'Customer Alpha', revenue: 14160, invoiceCount: 6 }],
    });
    jest.spyOn(service, 'getSalesByChannel').mockResolvedValue([{
      channelId: 'location-a', channel: 'Main Warehouse', revenue: 17700, quantity: 5,
      profit: 7700, transactionCount: 7, averageOrderValue: 2528.57, marginPercent: 43.5, growthRate: null,
    }]);
    jest.spyOn(service as any, 'series').mockResolvedValue([
      { period: '2026-11-01', date: new Date('2026-11-01T00:00:00Z'), value: 0, percentChange: null, movingAverage: 0 },
      { period: '2026-11-03', date: new Date('2026-11-03T00:00:00Z'), value: 17700, percentChange: null, movingAverage: 8850 },
    ]);

    const baseFilter = {
      reportType: 'SALES_DASHBOARD',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-03',
      groupBy: 'DAILY',
      channelBy: 'LOCATION',
    };
    const csv = await service.exportReport('business-a', { ...baseFilter, format: 'CSV' } as any);
    const csvText = String(csv.content);
    expect(csvText).toContain('Sales By Channel');
    expect(csvText).toContain('Main Warehouse');
    expect(csvText).toContain('Revenue Trend');
    expect(csvText).toContain('"Group By"');
    expect(csvText).toContain('"Daily"');
    expect(csvText).not.toContain('Moving Average');
    expect(csvText).not.toContain('Percent Change');
    expect(csvText).toContain('17700');

    const pdf = await service.exportReport('business-a', { ...baseFilter, format: 'PDF' } as any);
    const pdfText = (pdf.content as Buffer).toString('ascii');
    expect(pdfText).toContain('Sales By Channel');
    expect(pdfText).toContain('Revenue Trend');
    expect(pdfText).toContain('(Daily) Tj');
    expect(pdfText).not.toContain('Moving Average');
    expect(pdfText).not.toContain('Percent Change');
    expect(pdfText).not.toContain('23:59:59');
    expect(pdfText).toContain('(Main Warehouse) Tj');
    expect(pdfText).not.toContain('Channel Id');

    const json = await service.exportReport('business-a', { ...baseFilter, format: 'JSON' } as any);
    const jsonReport = JSON.parse(String(json.content));
    expect(jsonReport.salesByChannel[0].channel).toBe('Main Warehouse');
    expect(jsonReport.channelBy).toBe('Location');
    expect(jsonReport.groupBy).toBe('Daily');
    expect(jsonReport.revenueTrend[1]).toEqual({ period: '2026-11-03', revenue: 17700 });

    const excel = await service.exportReport('business-a', { ...baseFilter, format: 'EXCEL' } as any);
    const workbook = excel.content as Buffer;
    expect(workbook.readUInt32LE(0)).toBe(0x04034b50);
    expect(workbook.length).toBeGreaterThan(1000);
    const workbookXml: string[] = [];
    for (let offset = 0; offset + 30 <= workbook.length && workbook.readUInt32LE(offset) === 0x04034b50;) {
      const method = workbook.readUInt16LE(offset + 8);
      const compressedSize = workbook.readUInt32LE(offset + 18);
      const nameLength = workbook.readUInt16LE(offset + 26);
      const extraLength = workbook.readUInt16LE(offset + 28);
      const bodyStart = offset + 30 + nameLength + extraLength;
      const body = workbook.subarray(bodyStart, bodyStart + compressedSize);
      workbookXml.push((method === 8 ? inflateRawSync(body) : body).toString('utf8'));
      offset = bodyStart + compressedSize;
    }
    const workbookText = workbookXml.join('\n');
    expect(workbookText).toContain('Sales By Channel');
    expect(workbookText).toContain('Main Warehouse');
    expect(workbookText).toContain('Revenue Trend');
    expect(workbookText).toContain('2026-11-03');
    expect(workbookText).not.toContain('Moving Average');
    expect(workbookText).not.toContain('Percent Change');
  });

  it('writes UTF-8 CSV with quoted cells and protects spreadsheet formula prefixes', () => {
    const csv = (service as any).toCsv({
      customerName: '=HYPERLINK("https://example.invalid")',
      note: 'line one, line two',
      currency: 'T"ZS',
    }) as string;

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=HYPERLINK(\"\"https://example.invalid\"\")");
    expect(csv).toContain('"line one, line two"');
    expect(csv).toContain('"T""ZS"');
    expect(csv).toContain('\r\n');
  });
});
