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
      defaultUnit: { name: 'Bottle' },
      buyingPrice: 10,
    };
    const productB = {
      id: 'product-b',
      name: 'Product B',
      sku: 'B',
      categoryId: 'category-b',
      category: { name: 'Snacks' },
      defaultUnit: { name: 'Pack' },
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
      inventoryMovement: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn()
          .mockResolvedValueOnce([
            { productId: 'product-a', _sum: { quantity: -1 } },
          ])
          .mockResolvedValueOnce([
            { productId: 'product-a', _sum: { quantity: -2 } },
          ]),
      },
      stockBalance: { findMany: jest.fn().mockResolvedValue([{ productId: 'product-a', quantity: 3 }]) },
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
      expect.objectContaining({ productId: 'product-a', revenue: 49, quantity: 1, currentStock: 3, unit: 'Bottle', inventoryTurnover: 0.18, estimatedDaysOfInventory: 165 }),
      expect.objectContaining({ productId: 'product-b', revenue: 36, quantity: 1, currentStock: 0, unit: 'Pack' }),
    ]));
    expect(result.period).toBe('2026-09-01 to 2026-09-30');
    expect(result.inventoryAsOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.definitions.currentStock).toContain('not a historical stock figure');
    expect(result.data.reduce((sum, product) => sum + product.revenue, 0)).toBe(85);
  });

  it('preserves return-period negative COGS and leaves margin unset for negative revenue', async () => {
    const product = {
      id: 'returned-product', name: 'Returned product', sku: 'RET-1', categoryId: 'category-a',
      category: { name: 'Drinks' }, defaultUnit: { name: 'Bottle' }, buyingPrice: 60,
    };
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'business-a', currency: 'TZS' }) },
      salesInvoice: { findMany: jest.fn().mockResolvedValue([]) },
      salesReturn: { findMany: jest.fn().mockResolvedValue([{ items: [{ productId: product.id, quantity: 2, total: 100 }] }]) },
      inventoryMovement: {
        findMany: jest.fn().mockResolvedValue([{ type: 'CUSTOMER_RETURN', productId: product.id, quantity: 2, unitCost: 60, product: { buyingPrice: 60 } }]),
        groupBy: jest.fn().mockResolvedValueOnce([{ productId: product.id, _sum: { quantity: 2 } }]).mockResolvedValueOnce([]),
      },
      stockBalance: { findMany: jest.fn().mockResolvedValue([{ productId: product.id, quantity: 2 }]) },
      product: { findMany: jest.fn().mockResolvedValue([product]) },
    };
    const service = new AnalyticsService(prisma as any, {} as any, {} as any);

    const result = await service.getProductPerformance('business-a', {
      dateFrom: '2026-11-03', dateTo: '2026-11-03', page: 1, limit: 20,
    } as any);

    expect(result.data[0]).toEqual(expect.objectContaining({
      quantity: -2, revenue: -100, cogs: -120, profit: 20, marginPercent: null,
    }));
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

describe('AnalyticsService customer analytics', () => {
  it('reconciles return-aware period revenue, invoice count and as-of purchase recency for active customers', async () => {
    const purchaseDate = new Date('2026-11-15T00:00:00.000Z');
    const invoice = { customerId: 'customer-a', totalAmount: 100, issuedDate: purchaseDate };
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'business-a', currency: 'TZS', timezone: 'Africa/Dar_es_Salaam', financialYear: 'CALENDAR',
          settings: { dateFormat: 'DD/MM/YYYY', weekStartsOn: 'MONDAY' },
        }),
      },
      accountingPeriod: { findFirst: jest.fn() },
      customer: { findMany: jest.fn().mockResolvedValue([
        { id: 'customer-a', businessId: 'business-a', name: 'Alpha', customerCode: 'A', customerType: 'RETAIL' },
        { id: 'customer-b', businessId: 'business-a', name: 'Never Purchased', customerCode: 'B', customerType: 'RETAIL' },
      ]) },
      salesInvoice: {
        findMany: jest.fn().mockResolvedValueOnce([invoice]).mockResolvedValueOnce([invoice]),
      },
      salesReturn: {
        findMany: jest.fn().mockResolvedValue([{
          customerId: 'customer-a', totalAmount: 20,
          returnDate: new Date('2026-11-15T10:00:00.000Z'), invoice: { customerId: 'customer-a' },
        }]),
      },
    };
    const service = new AnalyticsService(prisma as any, {} as any, {} as any);

    const result = await service.getCustomerAnalytics('business-a', {
      dateFrom: '2026-11-01', dateTo: '2026-11-15', segmentBy: 'REVENUE', page: 1, limit: 20,
    } as any);

    expect(prisma.customer.findMany).toHaveBeenCalledWith({ where: { businessId: 'business-a', isActive: true } });
    expect(result).toMatchObject({ period: '2026-11-01 to 2026-11-15', currency: 'TZS', segmentBy: 'REVENUE' });
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ customerId: 'customer-a', totalRevenue: 80, invoiceCount: 1, averageOrderValue: 80, lastPurchaseDate: purchaseDate, daysInactive: 0, segment: 'VIP' }),
      expect.objectContaining({ customerId: 'customer-b', totalRevenue: 0, invoiceCount: 0, averageOrderValue: null, lastPurchaseDate: null, daysInactive: null, loyaltyScore: 0, segment: 'INACTIVE' }),
    ]));
    expect(result.definitions.averageOrderValue).toContain('unavailable when there are no invoices');
  });

  it('uses midrank percentiles for positive ties and zeroes non-positive spend/frequency percentiles', () => {
    const service = new AnalyticsService({} as any, {} as any, {} as any);
    expect((service as any).percentile([0, 0, 0], 0)).toBe(0);
    expect((service as any).percentile([-5, 0, 0], -5)).toBe(0);
    expect((service as any).percentile([0, 10, 20], 10)).toBe(50);
    expect((service as any).percentile([0, 10, 10, 20], 10)).toBe(50);
    expect((service as any).percentile([0, 10, 20], 20)).toBe(100);
  });
});

describe('AnalyticsService supplier analytics', () => {
  it('applies PO discounts, measures processed GRNs and never assumes missing expected dates were on time', async () => {
    const range = {
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-16T23:59:59.999Z'),
      periodName: '2026-11-01 to 2026-11-16',
      weekStartsOn: 'MONDAY',
    };
    const acceptedGrn = {
      status: 'ACCEPTED', receivedDate: new Date('2026-11-05T12:00:00.000Z'),
      items: [{ acceptedQuantity: 4, rejectedQuantity: 1, damageQuantity: 0,
        purchaseOrderItem: { quantity: 10, unitPrice: 100, lineTotal: 800 } }],
    };
    const rejectedGrn = {
      status: 'REJECTED', receivedDate: new Date('2026-11-07T12:00:00.000Z'),
      items: [{ acceptedQuantity: 2, rejectedQuantity: 0, damageQuantity: 0,
        purchaseOrderItem: { quantity: 10, unitPrice: 100, lineTotal: 800 } }],
    };
    const noDueDateGrn = {
      status: 'ACCEPTED', receivedDate: new Date('2026-11-03T12:00:00.000Z'),
      items: [{ acceptedQuantity: 2, rejectedQuantity: 0, damageQuantity: 1,
        purchaseOrderItem: { quantity: 5, unitPrice: 50, lineTotal: 250 } }],
    };
    const prisma = {
      supplier: { findMany: jest.fn().mockResolvedValue([{
        id: 'supplier-a', businessId: 'business-a', name: 'Test Supplier', supplierCode: 'SUP-1',
        purchaseOrders: [
          { id: 'po-a', orderDate: new Date('2026-11-01T12:00:00.000Z'), expectedDeliveryDate: new Date('2026-11-06T00:00:00.000Z'), grns: [acceptedGrn, rejectedGrn] },
          { id: 'po-b', orderDate: new Date('2026-11-03T12:00:00.000Z'), expectedDeliveryDate: null, grns: [noDueDateGrn] },
          { id: 'po-c', orderDate: new Date('2026-11-04T12:00:00.000Z'), expectedDeliveryDate: null, grns: [] },
        ],
      }, {
        id: 'supplier-b', businessId: 'business-a', name: 'No Receipt Supplier', supplierCode: 'SUP-2',
        purchaseOrders: [{ id: 'po-d', orderDate: new Date('2026-11-08T12:00:00.000Z'), expectedDeliveryDate: null, grns: [] }],
      }]) },
    };
    const service = new AnalyticsService(prisma as any, {} as any, {} as any);
    jest.spyOn(service as any, 'getDateRange').mockResolvedValue(range);
    jest.spyOn(service as any, 'businessInfo').mockResolvedValue({ currency: 'TZS' });

    const result = await service.getSupplierAnalytics('business-a', {
      dateFrom: '2026-11-01', dateTo: '2026-11-16', page: 1, limit: 20,
    } as any);

    expect(prisma.supplier.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: 'business-a' },
      include: expect.objectContaining({ purchaseOrders: expect.objectContaining({
        where: expect.objectContaining({ status: { notIn: ['DRAFT', 'CANCELLED'] } }),
      }) }),
    }));
    expect(result).toMatchObject({ period: range.periodName, currency: 'TZS', total: 2 });
    expect(result.data[0]).toMatchObject({
      purchaseOrderCount: 3, acceptedPurchaseValue: 420, acceptedQuantity: 6,
      rejectedQuantity: 3, damagedQuantity: 1, onTimeDeliveryPercent: 100,
      qualityScore: 60, averageLeadTimeDays: 2, riskLevel: 'UNKNOWN',
      dataCoverage: 'GRN quality measured; expected-date coverage 66.67%',
    });
    expect(result.data[1]).toMatchObject({
      purchaseOrderCount: 1, acceptedPurchaseValue: 0, acceptedQuantity: 0,
      onTimeDeliveryPercent: null, qualityScore: null, averageLeadTimeDays: null,
      riskLevel: 'UNKNOWN', dataCoverage: 'No processed GRN by period end',
    });
    const purchaseOrderQuery = prisma.supplier.findMany.mock.calls[0][0].include.purchaseOrders;
    expect(purchaseOrderQuery.include.grns.where).toEqual({
      status: { in: ['ACCEPTED', 'REJECTED'] },
      receivedDate: { lte: range.endDate },
    });
    expect(result.asOf).toBe(range.endDate.toISOString());
    expect(result.definitions.acceptedPurchaseValue).toContain('after line discount');
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

  it.each([
    ['INCOME_STATEMENT', 'income statement', 'revenue'],
    ['CASH_FLOW', 'cash flow', 'totalInflows'],
    ['RECEIVABLES_AGEING', 'receivables ageing', 'grandTotal'],
    ['PAYABLES_AGEING', 'payables ageing', 'grandTotal'],
    ['EXPENSE_BREAKDOWN', 'expense breakdown', 'amount'],
    ['FINANCIAL_SUMMARY', 'business position', 'cashOnHand'],
    ['TRIAL_BALANCE', 'operational balance summary', 'totalDebits'],
  ] as const)(
    'exports the Finance dropdown report %s in each supported format',
    async (reportType, reportLabel, marker) => {
      const range = {
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-11-16T23:59:59.999Z'),
        periodName: '2026-11-01 to 2026-11-16',
      };
      const payload = { period: range.periodName, currency: 'TZS', [marker]: 1250, rows: [{ value: 1250 }] };
      const payments = {
        getIncomeStatement: jest.fn().mockResolvedValue(payload),
        getCashFlowReport: jest.fn().mockResolvedValue(payload),
        getReceivablesAgeingReport: jest.fn().mockResolvedValue(payload),
        getPayablesAgeingReport: jest.fn().mockResolvedValue(payload),
        getFinancialSummary: jest.fn().mockResolvedValue(payload),
        getTrialBalanceReport: jest.fn().mockResolvedValue(payload),
      };
      const service = new AnalyticsService({} as any, payments as any, {} as any);
      jest.spyOn(service as any, 'getDateRange').mockResolvedValue(range);
      jest.spyOn(service, 'getExpenseBreakdown').mockResolvedValue([payload] as any);

      for (const format of ['PDF', 'EXCEL', 'CSV', 'JSON'] as const) {
        const result = await service.exportReport('business-a', {
          reportType, format, dateFrom: '2026-11-01', dateTo: '2026-11-16', groupBy: 'DAILY',
        } as any);
        expect(result.fileName).toContain(reportType.toLowerCase());
        expect(result.fileName.endsWith(format === 'EXCEL' ? '.xlsx' : `.${format.toLowerCase()}`)).toBe(true);
        if (format === 'JSON') {
          const json = JSON.parse(String(result.content));
          if (reportType === 'EXPENSE_BREAKDOWN') expect(json).toEqual([payload]);
          else expect(json).toMatchObject(payload);
        } else if (format === 'PDF') {
          expect((result.content as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
          expect((result.content as Buffer).toString('ascii')).toContain('2026-11-01 to 2026-11-16');
        } else if (format === 'EXCEL') {
          expect((result.content as Buffer).readUInt32LE(0)).toBe(0x04034b50);
        } else {
          expect(String(result.content)).toContain('2026-11-01 to 2026-11-16');
        }
      }
      expect(reportLabel).toBeTruthy();
      jest.restoreAllMocks();
    },
  );

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

  it('omits internal product and category IDs from the human-facing product PDF', () => {
    const pdf = (service as any).toPdf({
      period: '2026-11-01 to 2026-11-15', currency: 'TZS', total: 1,
      inventoryAsOf: '2026-11-15T13:00:00.000Z',
      definitions: { currentStock: 'Live stock snapshot.', catalogLabels: 'Current catalog labels.' },
      products: [{
        productId: 'internal-product-id', productName: 'PH21 Stock and Returns Test Product',
        productSku: 'PH21-BEV-001', categoryId: 'internal-category-id', categoryName: 'Beverages',
        currentStock: 94, quantity: 6, revenue: 16776, cogs: 12000, profit: 4776, marginPercent: 28.47,
        inventoryTurnover: 0.06, estimatedDaysOfInventory: 242.5, unit: 'Bottle',
      }],
    }, 'PRODUCT_PERFORMANCE').toString('ascii');

    expect(pdf).toContain('(2026-11-01 to 2026-11-15) Tj');
    expect(pdf).toContain('(PH21 Stock and Returns) Tj');
    expect(pdf).toContain('(Test Product) Tj');
    expect(pdf).toContain('PH21-BEV');
    expect(pdf).toContain('(Sold) Tj');
    expect(pdf).toContain('(Revenue) Tj');
    expect(pdf).toContain('(Profit) Tj');
    expect(pdf).toContain('(Margin) Tj');
    expect(pdf).toContain('(Days) Tj');
    expect(pdf).toContain('(Beverages) Tj');
    expect(pdf).toContain('(12,000) Tj');
    expect(pdf).toContain('(242.5) Tj');
    const skuX = Number(pdf.match(/BT \/F1 12 Tf ([\d.]+) [\d.]+ Td \(PH21-BEV-001\) Tj ET/)?.[1]);
    const categoryX = Number(pdf.match(/BT \/F1 12 Tf ([\d.]+) [\d.]+ Td \(Beverages\) Tj ET/)?.[1]);
    expect(Number.isFinite(skuX)).toBe(true);
    expect(categoryX - skuX).toBeGreaterThan(100);
    expect(pdf).not.toContain('internal-product-id');
    expect(pdf).not.toContain('internal-category-id');
    expect(pdf).not.toContain('Product Id');
    expect(pdf).not.toContain('Category Id');
  });

  it('includes the selected period and products but does not export API pagination metadata', async () => {
    const getProductPerformance = jest.spyOn(service, 'getProductPerformance').mockResolvedValue({
      period: '2026-11-01 to 2026-11-15', currency: 'TZS', total: 1,
      inventoryAsOf: '2026-11-15T18:00:00.000Z',
      definitions: { currentStock: 'Live stock snapshot.', estimatedDaysOfInventory: 'Uses unrounded turnover.' },
      page: 1, limit: 10000,
      data: [{ productName: 'Product A', productSku: 'A-1', revenue: 100 }],
    } as any);

    const result = await service.exportReport('business-a', {
      reportType: 'PRODUCT_PERFORMANCE', format: 'CSV',
      dateFrom: '2026-11-01', dateTo: '2026-11-15',
    } as any);
    const csv = result.content.toString();
    getProductPerformance.mockRestore();

    expect(csv).toContain('2026-11-01 to 2026-11-15');
    expect(csv).toContain('Product A');
    expect(csv).toContain('Inventory As Of');
    expect(csv).toContain('2026-11-15T18:00:00.000Z');
    expect(csv).toContain('Estimated Days Of Inventory');
    expect(csv).toContain('Uses unrounded turnover.');
    expect(csv).not.toContain('"Page"');
    expect(csv).not.toContain('"Limit"');
  });

  it.each(['JSON', 'CSV', 'EXCEL', 'PDF'] as const)(
    'includes stock snapshot time and metric definitions in %s product exports',
    async (format) => {
      const getProductPerformance = jest.spyOn(service, 'getProductPerformance').mockResolvedValue({
        period: '2026-11-01 to 2026-11-15', currency: 'TZS', total: 1,
        inventoryAsOf: '2026-11-15T18:00:00.000Z',
        definitions: { currentStock: 'Live stock snapshot.', estimatedDaysOfInventory: 'Uses unrounded turnover.' },
        page: 1, limit: 10000,
        data: [{ productName: 'Product A', productSku: 'A-1', currentStock: 94, revenue: 100 }],
      } as any);

      const result = await service.exportReport('business-a', {
        reportType: 'PRODUCT_PERFORMANCE', format,
        dateFrom: '2026-11-01', dateTo: '2026-11-15',
      } as any);
      getProductPerformance.mockRestore();

      let exportedText: string;
      if (format === 'EXCEL') {
        const workbook = result.content as Buffer;
        const parts: string[] = [];
        for (let offset = 0; offset + 30 <= workbook.length && workbook.readUInt32LE(offset) === 0x04034b50;) {
          const method = workbook.readUInt16LE(offset + 8);
          const compressedSize = workbook.readUInt32LE(offset + 18);
          const nameLength = workbook.readUInt16LE(offset + 26);
          const extraLength = workbook.readUInt16LE(offset + 28);
          const bodyStart = offset + 30 + nameLength + extraLength;
          const body = workbook.subarray(bodyStart, bodyStart + compressedSize);
          parts.push((method === 8 ? inflateRawSync(body) : body).toString('utf8'));
          offset = bodyStart + compressedSize;
        }
        exportedText = parts.join('\n');
      } else {
        exportedText = String(result.content);
      }

      expect(exportedText).toContain('2026-11-15T18:00:00.000Z');
      expect(exportedText).toContain('Live stock snapshot.');
      expect(exportedText).toContain('Uses unrounded turnover.');
      if (format === 'JSON') expect(JSON.parse(exportedText).definitions.currentStock).toBe('Live stock snapshot.');
    },
  );

  it.each(['JSON', 'CSV', 'EXCEL', 'PDF'] as const)(
    'exports customer period, ranking, definitions and customer rows without pagination internals in %s',
    async (format) => {
      const getCustomerAnalytics = jest.spyOn(service, 'getCustomerAnalytics').mockResolvedValue({
        period: '2026-11-01 to 2026-11-15', asOf: '2026-11-15T23:59:59.999Z', currency: 'TZS',
        segmentBy: 'RECENCY', total: 2, page: 1, limit: 10000,
        definitions: { totalRevenue: 'Net invoice revenue after accepted returns.', loyaltyScore: 'A ranking guide.' },
        data: [{
          customerId: 'internal-customer-id', customerName: 'PH21 Filter Customer Alpha', customerCode: 'PH21-CUST-A',
          customerType: 'RETAIL', totalRevenue: 14160, invoiceCount: 6, averageOrderValue: 2360,
          lastPurchaseDate: '2026-11-15T00:00:00.000Z', daysInactive: 0, loyaltyScore: 95, segment: 'VIP',
        }, {
          customerId: 'internal-customer-id-2', customerName: 'PH22 Address Contacts Customer', customerCode: 'CUST-00008',
          customerType: 'RETAIL', totalRevenue: 0, invoiceCount: 0, averageOrderValue: null,
          lastPurchaseDate: null, daysInactive: null, loyaltyScore: 0, segment: 'INACTIVE',
        }],
      } as any);

      const result = await service.exportReport('business-a', {
        reportType: 'CUSTOMER_ANALYTICS', format,
        dateFrom: '2026-11-01', dateTo: '2026-11-15', segmentBy: 'RECENCY',
      } as any);
      expect(getCustomerAnalytics.mock.calls[0][1].segmentBy).toBe('RECENCY');
      getCustomerAnalytics.mockRestore();

      let exportedText: string;
      if (format === 'EXCEL') {
        const workbook = result.content as Buffer;
        const parts: string[] = [];
        for (let offset = 0; offset + 30 <= workbook.length && workbook.readUInt32LE(offset) === 0x04034b50;) {
          const method = workbook.readUInt16LE(offset + 8);
          const compressedSize = workbook.readUInt32LE(offset + 18);
          const nameLength = workbook.readUInt16LE(offset + 26);
          const extraLength = workbook.readUInt16LE(offset + 28);
          const bodyStart = offset + 30 + nameLength + extraLength;
          const body = workbook.subarray(bodyStart, bodyStart + compressedSize);
          parts.push((method === 8 ? inflateRawSync(body) : body).toString('utf8'));
          offset = bodyStart + compressedSize;
        }
        exportedText = parts.join('\n');
      } else {
        exportedText = String(result.content);
      }

      expect(exportedText).toContain('2026-11-01 to 2026-11-15');
      expect(exportedText).toContain('PH21 Filter Customer Alpha');
      expect(exportedText).toContain('RECENCY');
      if (format === 'PDF') {
        expect(exportedText).toContain('(Metric guide) Tj');
        expect(exportedText).toContain('accepted returns dated in');
        expect(exportedText).toContain('(the period.) Tj');
        expect(exportedText).not.toContain('Definitions /');
        expect(exportedText).toContain('(Last) Tj');
        expect(exportedText).toContain('(Purchase) Tj');
        expect(exportedText).toContain('(2026-11-15) Tj');
        expect(exportedText).toContain('(Inv) Tj');
        expect(exportedText).toContain('(PH22 Address Contacts Customer) Tj');
        expect(exportedText).toContain('(CUST-00008) Tj');
        expect(exportedText).toContain('(95%) Tj');
        expect(exportedText).toContain('(0%) Tj');
        expect(exportedText.match(/\/Type \/Page /g)).toHaveLength(2);
        const customerX = Number(exportedText.match(/BT \/F1 12 Tf ([\d.]+) [\d.]+ Td \(PH21 Filter Customer Alpha\) Tj ET/)?.[1]);
        const codeX = Number(exportedText.match(/BT \/F1 12 Tf ([\d.]+) [\d.]+ Td \(PH21-CUST-A\) Tj ET/)?.[1]);
        expect(Number.isFinite(customerX)).toBe(true);
        expect(codeX - customerX).toBeGreaterThan(100);
      } else {
        expect(exportedText).toContain('Net invoice revenue after accepted returns.');
      }
      if (format === 'JSON') {
        const json = JSON.parse(exportedText);
        expect(json.customers).toHaveLength(2);
        expect(json.page).toBeUndefined();
        expect(json.limit).toBeUndefined();
      }
    },
  );

  it.each(['JSON', 'CSV', 'EXCEL', 'PDF'] as const)(
    'exports supplier metadata and rows without pagination internals or supplier IDs in %s',
    async (format) => {
      jest.spyOn(service, 'getSupplierAnalytics').mockResolvedValue({
        period: '2026-11-01 to 2026-11-16', asOf: '2026-11-16T23:59:59.999Z', currency: 'TZS',
        total: 1, page: 1, limit: 10000, totalPages: 1,
        definitions: { acceptedPurchaseValue: 'Net accepted lines after discounts.' },
        data: [{
          supplierId: 'internal-supplier-id', supplierName: 'Test Supplier Ltd', supplierCode: 'SUP-00001',
          purchaseOrderCount: 5, acceptedPurchaseValue: 5100, acceptedQuantity: 16,
          rejectedQuantity: 0, damagedQuantity: 0, onTimeDeliveryPercent: 100, qualityScore: 100,
          averageLeadTimeDays: 0, riskLevel: 'UNKNOWN', dataCoverage: 'GRN quality measured; expected-date coverage 18.75%',
        }],
      } as any);
      const result = await service.exportReport('business-a', {
        reportType: 'SUPPLIER_ANALYTICS', format,
        dateFrom: '2026-11-01', dateTo: '2026-11-16',
      } as any);

      let exportedText: string;
      if (format === 'EXCEL') {
        const workbook = result.content as Buffer;
        const parts: string[] = [];
        for (let offset = 0; offset + 30 <= workbook.length && workbook.readUInt32LE(offset) === 0x04034b50;) {
          const method = workbook.readUInt16LE(offset + 8);
          const compressedSize = workbook.readUInt32LE(offset + 18);
          const nameLength = workbook.readUInt16LE(offset + 26);
          const extraLength = workbook.readUInt16LE(offset + 28);
          const bodyStart = offset + 30 + nameLength + extraLength;
          const body = workbook.subarray(bodyStart, bodyStart + compressedSize);
          parts.push((method === 8 ? inflateRawSync(body) : body).toString('utf8'));
          offset = bodyStart + compressedSize;
        }
        exportedText = parts.join('\n');
      } else {
        exportedText = String(result.content);
      }
      expect(exportedText).toContain('2026-11-01 to 2026-11-16');
      expect(exportedText).toContain('Test Supplier Ltd');
      expect(exportedText).not.toContain('totalPages');
      expect(exportedText).not.toContain('10000');
      if (format === 'PDF') {
        expect(exportedText).not.toContain('internal-supplier-id');
        expect(exportedText).toContain('(Metric guide) Tj');
        expect(exportedText).toContain('(On time) Tj');
        expect(exportedText).toContain('below 70%');
        expect(exportedText).toContain('(Quality) Tj');
        expect(exportedText).toContain('(100%) Tj');
        expect(exportedText).toContain('(UNKNOWN) Tj');
        expect(exportedText).toContain('(Accepted value) Tj');
        expect(exportedText).not.toContain('(Definitions /');
      } else if (format === 'JSON') {
        const json = JSON.parse(exportedText);
        expect(json.suppliers).toHaveLength(1);
        expect(json.suppliers[0].supplierId).toBe('internal-supplier-id');
        expect(json.page).toBeUndefined();
        expect(json.limit).toBeUndefined();
        expect(json.totalPages).toBeUndefined();
        expect(json.definitions.acceptedPurchaseValue).toContain('discounts');
      } else {
        expect(exportedText).not.toContain('internal-supplier-id');
        expect(exportedText).toContain('Accepted Purchase Value');
        expect(exportedText).toContain('after discounts');
      }
      jest.restoreAllMocks();
    },
  );

  it('fits a short customer table on one page instead of orphaning its final row', () => {
    const pdf = (service as any).toPdf(
      salesReport(['Customer Alpha', 'Customer Beta', 'Customer Gamma']),
      'SALES_DASHBOARD',
    ).toString('ascii');
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(1);
    expect(pdf).toContain('Customer Alpha');
    expect(pdf).toContain('Customer Gamma');
    expect(pdf).toContain('(Page 1 of 1)');
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

  it('keeps a one-row Top Products section on the revenue page instead of creating a mostly empty final page', () => {
    const periods = Array.from({ length: 15 }, (_, index) => `2026-11-${String(index + 1).padStart(2, '0')}`);
    const dashboard = {
      period: '2026-11-01 to 2026-11-15',
      currency: 'TZS',
      summary: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [
        `metric${index}`,
        { label: `Metric ${index}`, value: index * 1000, unit: 'TZS', trend: 'UP', status: 'GOOD' },
      ])),
      charts: {
        periods,
        revenueVsExpenses: [
          { label: 'Revenue', data: periods.map((_, index) => index === 2 ? 17700 : index === 3 ? 3540 : 0) },
          { label: 'Expenses', data: periods.map(() => 0) },
        ],
        topProducts: { labels: ['PH21 Stock and Returns Test Product'], revenue: [16776], quantity: [6] },
      },
      definitions: {
        revenue: 'Issued invoice totals less accepted customer returns in the selected period.',
        profit: 'Net income from the existing income statement (revenue less inventory-movement COGS and approved/paid expenses).',
        purchases: 'Non-draft, non-cancelled purchase order totals by order date; this is procurement volume, not COGS.',
        cashPosition: 'Cumulative active ledger inflows minus outflows through the selected as-of date.',
        inventoryValue: 'Inventory service valuation using WEIGHTED_AVERAGE.',
        inventoryValuationTiming: 'Current stock snapshot as of the inventory date shown above; selected date range applies to period flows, not historical inventory valuation.',
      },
    };
    const pdf = (service as any).toPdf(dashboard, 'DASHBOARD').toString('ascii');

    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(3);
    expect(pdf).toContain('Top Products');
    expect(pdf).toContain('PH21 Stock and Returns Test Product');
    expect(pdf).toContain('(Page 3 of 3)');
    expect(pdf).not.toContain('(Page 4 of 4)');
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
      summary: {
        totalRevenue: {
          label: 'Total Revenue', value: 17700, unit: 'TZS', previousValue: 0,
          changePercent: null, trend: 'UP', status: 'GOOD',
        },
      },
      topCustomers: [{ customerId: 'customer-a', customerName: 'Customer Alpha', revenue: 14160, invoiceCount: 6 }],
    } as any);
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
    expect(pdfText).toContain('(-) Tj');
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
    const changePercentCell = workbookText.match(/<c r="E3"[^>]*>[\s\S]*?<\/c>/)?.[0];
    expect(changePercentCell).toContain('—');
    expect(workbookText).toContain('Sales By Channel');
    expect(workbookText).toContain('Main Warehouse');
    expect(workbookText).toContain('Revenue Trend');
    expect(workbookText).toContain('2026-11-03');
    expect(workbookText).toContain('—');
    expect(workbookText).toContain('customWidth="1"');
    expect(workbookText).not.toContain('state="frozen"');
    expect(workbookText).not.toContain('Moving Average');
    expect(workbookText).not.toContain('Percent Change');
  });

  it('writes UTF-8 CSV with quoted cells and protects spreadsheet formula prefixes', () => {
    const csv = (service as any).toCsv({
      customerName: '=HYPERLINK("https://example.invalid")',
      note: 'line one, line two',
      currency: 'T"ZS',
      availableRate: null,
    }) as string;

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=HYPERLINK(\"\"https://example.invalid\"\")");
    expect(csv).toContain('"line one, line two"');
    expect(csv).toContain('"T""ZS"');
    expect(csv).toContain('"—"');
    expect(csv).toContain('\r\n');
  });
});
