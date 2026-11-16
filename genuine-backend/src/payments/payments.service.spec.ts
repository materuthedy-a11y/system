import { PaymentsService } from './payments.service';

describe('PaymentsService financial report consistency', () => {
  it('uses the same legacy invoice-payment direction in cash flow and as-of financial reports', async () => {
    const payments = [
      {
        id: 'legacy-invoice-payment',
        amount: 100,
        direction: null,
        invoiceId: null,
        referenceType: 'SalesInvoice',
        paymentDate: new Date('2026-11-05T12:00:00.000Z'),
        status: 'RECORDED',
      },
      {
        id: 'legacy-other-payment',
        amount: 25,
        direction: null,
        invoiceId: null,
        referenceType: 'Other',
        paymentDate: new Date('2026-11-06T12:00:00.000Z'),
        status: 'RECORDED',
      },
    ];
    const prisma = {
      payment: { findMany: jest.fn().mockResolvedValue(payments) },
      business: {
        findUnique: jest.fn().mockResolvedValue({
          currency: 'TZS',
          timezone: 'Africa/Dar_es_Salaam',
          settings: { weekStartsOn: 'MONDAY' },
        }),
      },
      salesInvoice: { findMany: jest.fn().mockResolvedValue([]) },
      salesReturn: { findMany: jest.fn().mockResolvedValue([]) },
      purchaseOrder: { findMany: jest.fn().mockResolvedValue([]) },
      expense: { findMany: jest.fn().mockResolvedValue([]) },
      purchaseReturn: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryMovement: { findMany: jest.fn().mockResolvedValue([]) },
      stockBalance: { findMany: jest.fn().mockResolvedValue([]) },
      accountingPeriod: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const inventory = {
      getStockValuationReport: jest.fn().mockResolvedValue({ totalValue: 0, costingMethod: 'WEIGHTED_AVERAGE' }),
    };
    const service = new PaymentsService(prisma as any, inventory as any, {} as any);

    const cashFlow = await service.getCashFlowReport('business-a', {
      dateFrom: '2026-11-01', dateTo: '2026-11-15', groupBy: 'DAILY',
    } as any);
    const summary = await service.getFinancialSummary('business-a', { dateAs: '2026-11-15' } as any);
    const operationalBalance = await service.getTrialBalanceReport('business-a', { dateAs: '2026-11-15' } as any);

    expect(cashFlow.totalInflows).toBe(100);
    expect(cashFlow.totalOutflows).toBe(25);
    expect(cashFlow.closingBalance).toBe(75);
    expect(summary.cashOnHand).toBe(cashFlow.closingBalance);
    expect(operationalBalance.items.find((item) => item.accountName.startsWith('Cash'))?.debit).toBe(cashFlow.closingBalance);
  });
});
