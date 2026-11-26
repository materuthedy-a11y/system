import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../common/pipes';
import { CreateStockAdjustmentDto } from './dto/inventory.dto';

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
