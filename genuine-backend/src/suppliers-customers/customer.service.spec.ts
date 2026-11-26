import { Prisma } from '@prisma/client';
import { LoggerService } from '../common/logger/logger.service';
import { PrismaService } from '../database/prisma.service';
import { CreateCustomerDto, CustomerResponseDto } from './dto';
import { CustomerService } from './customer.service';

describe('CustomerService customer code generation', () => {
  it('uses the highest existing generated code when the customer count has gaps', async () => {
    const existingCodes = ['CUST-00014', 'CUST-00015', 'PH21-CUST-X'];
    const create = jest.fn().mockResolvedValue({ id: 'new-customer-id' });
    const findMany = jest
      .fn()
      .mockResolvedValue(existingCodes.map((customerCode) => ({ customerCode })));
    const findFirst = jest
      .fn()
      .mockImplementation(
        (args: { where: { OR: Array<{ name?: string; customerCode?: string }> } }) =>
          existingCodes.some((code) =>
            args.where.OR.some((condition) => condition.customerCode === code),
          )
            ? Promise.resolve({ id: 'existing-customer-id' })
            : Promise.resolve(null),
      );
    const transactionClient = {
      customer: { create },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      customer: { findMany, findFirst },
      $transaction: jest.fn(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(transactionClient as unknown as Prisma.TransactionClient),
      ),
    };
    const service = new CustomerService(
      prisma as unknown as PrismaService,
      { log: jest.fn() } as unknown as LoggerService,
    );
    const now = new Date();
    const response: CustomerResponseDto = {
      id: 'new-customer-id',
      businessId: 'business-a',
      name: 'Phase 24 QA Stockout Test Customer',
      customerCode: 'CUST-00016',
      customerType: 'RETAIL',
      email: 'phase24-stockout-qa@example.test',
      phone: '+12025550100',
      contacts: [],
      creditLimit: 100000,
      paymentTerms: 'NET-30',
      openingBalance: 0,
      totalSales: 0,
      totalPaid: 0,
      totalReturned: 0,
      outstandingBalance: 0,
      creditUtilization: 0,
      isActive: true,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    jest.spyOn(service, 'getCustomerById').mockResolvedValue(response);
    const input: CreateCustomerDto = {
      name: response.name,
      customerType: 'RETAIL',
      email: response.email,
      phone: response.phone,
      creditLimit: response.creditLimit,
      paymentTerms: 'NET-30',
      openingBalance: 0,
      isActive: true,
    };

    await service.createCustomer('business-a', 'user-a', input);

    expect(findMany).toHaveBeenCalledWith({
      where: { businessId: 'business-a', customerCode: { startsWith: 'CUST-' } },
      select: { customerCode: true },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        businessId: 'business-a',
        OR: [{ name: input.name }, { customerCode: 'CUST-00016' }],
      },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerCode: 'CUST-00016' }),
      }),
    );
  });
});
