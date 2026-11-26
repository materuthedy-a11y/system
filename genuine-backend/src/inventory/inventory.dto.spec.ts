import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../common/pipes';
import { CreateStockAdjustmentDto, CreateStockTransferDto } from './dto/inventory.dto';

const validAdjustment = {
  items: [
    {
      productId: 'qa-product',
      locationId: 'qa-location',
      quantity: 1,
      reason: 'INVENTORY_COUNT',
    },
  ],
};

async function validateAdjustment(payload: Record<string, unknown>) {
  return createValidationPipe().transform(payload, {
    type: 'body',
    metatype: CreateStockAdjustmentDto,
  });
}

async function validateTransfer(payload: Record<string, unknown>) {
  return createValidationPipe().transform(payload, {
    type: 'body',
    metatype: CreateStockTransferDto,
  });
}

describe('CreateStockAdjustmentDto validation', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['invalid', 'NOT_A_REASON'],
  ])('rejects a %s adjustment reason', async (_caseName, reason) => {
    const item = { ...validAdjustment.items[0] };
    if (reason === undefined) {
      delete (item as { reason?: string }).reason;
    } else {
      (item as { reason?: string }).reason = reason;
    }

    await expect(validateAdjustment({ items: [item] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a supported adjustment reason', async () => {
    await expect(validateAdjustment(validAdjustment)).resolves.toBeDefined();
  });
});

describe('CreateStockTransferDto validation', () => {
  const validTransfer = {
    fromLocationId: 'qa-main',
    toLocationId: 'qa-branch',
    items: [{ productId: 'qa-product', quantity: 1 }],
  };

  it.each([0, -1])('rejects a non-positive transfer quantity (%s)', async (quantity) => {
    await expect(
      validateTransfer({
        ...validTransfer,
        items: [{ ...validTransfer.items[0], quantity }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts the minimum positive transfer quantity', async () => {
    await expect(
      validateTransfer({
        ...validTransfer,
        items: [{ ...validTransfer.items[0], quantity: 0.0001 }],
      }),
    ).resolves.toBeDefined();
  });
});
