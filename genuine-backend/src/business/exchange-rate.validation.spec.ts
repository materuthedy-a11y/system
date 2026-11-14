import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import { createValidationPipe } from '../common/pipes';
import { PrismaService } from '../database/prisma.service';
import { CreateExchangeRateDto } from './dto/exchange-rate.dto';
import { BusinessService } from './business.service';
import { CreateSalesInvoiceDto } from '../sales/dto/create-sales-invoice.dto';
import { CreatePurchaseOrderDto } from '../purchases/dto/create-purchase-order.dto';
import { CreatePaymentDto } from '../payments/dto/payment.dto';

const validRate = {
  currencyCode: 'USD',
  rateToBase: 2644.8117,
  effectiveFrom: '2026-11-14',
};

async function validateCreateRate(payload: Record<string, unknown>) {
  return createValidationPipe().transform(payload, {
    type: 'body',
    metatype: CreateExchangeRateDto,
  });
}

async function validateDto(payload: Record<string, unknown>, metatype: new (...args: never[]) => unknown) {
  return createValidationPipe().transform(payload, { type: 'body', metatype });
}

describe('Exchange rate API validation', () => {
  it.each([
    ['malformed currency code', { ...validRate, currencyCode: 'US1' }],
    ['zero rate', { ...validRate, rateToBase: 0 }],
    ['negative rate', { ...validRate, rateToBase: -1 }],
    ['rate with more than eight decimal places', { ...validRate, rateToBase: 1.123456789 }],
    ['malformed effective date', { ...validRate, effectiveFrom: 'not-a-date' }],
  ])('rejects %s before the controller can save it', async (_caseName, payload) => {
    await expect(validateCreateRate(payload)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes a valid currency code before it reaches the service', async () => {
    const result = await validateCreateRate({ ...validRate, currencyCode: ' usd ' });
    expect(result).toMatchObject({ ...validRate, currencyCode: 'USD' });
  });

  it('rejects the business base currency without creating a rate or audit event', async () => {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ currency: 'TZS' }) },
      businessExchangeRate: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new BusinessService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      {} as LoggerService,
    );

    await expect(service.createExchangeRate('business-1', 'user-1', {
      ...validRate,
      currencyCode: 'TZS',
      rateToBase: 1,
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.businessExchangeRate.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('lists rates only for the requested business and its current base currency', async () => {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ currency: 'TZS' }) },
      businessExchangeRate: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new BusinessService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      {} as LoggerService,
    );

    await service.listExchangeRates('business-a');

    expect(prisma.businessExchangeRate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: 'business-a', baseCurrency: 'TZS' },
    }));
  });

  it('does not convert using another business rate when the requested workspace has no rate', async () => {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ currency: 'TZS' }) },
      businessExchangeRate: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new BusinessService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      {} as LoggerService,
    );

    await expect(service.convertCurrency('business-a', {
      currencyCode: 'USD',
      amount: 100,
      asOf: '2026-11-14',
      direction: 'TO_BASE',
    })).rejects.toMatchObject({
      response: {
        statusCode: 404,
        message: 'No USD exchange rate is configured for 2026-11-14',
      },
    });

    expect(prisma.businessExchangeRate.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessId: 'business-a', baseCurrency: 'TZS', currencyCode: 'USD' }),
    }));
  });

  it.each([
    ['sales invoices', CreateSalesInvoiceDto],
    ['purchase orders', CreatePurchaseOrderDto],
    ['payments', CreatePaymentDto],
  ])('does not accept a transaction currency on %s', async (_recordType, dtoType) => {
    await expect(validateDto({ currencyCode: 'USD' }, dtoType)).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.arrayContaining([expect.stringContaining('property currencyCode should not exist')]),
      }),
    });
  });
});
