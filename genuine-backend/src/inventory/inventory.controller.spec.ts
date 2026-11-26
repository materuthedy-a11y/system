import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSION_KEY } from '../common/decorators/permission.decorator';
import { InventoryController } from './inventory.controller';

describe('InventoryController draft lifecycle routes', () => {
  it('exposes adjustment deletion only under inventory.adjust', () => {
    const handler = InventoryController.prototype.deleteDraftAdjustment;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('adjustments/:id');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.DELETE);
    expect(Reflect.getMetadata(PERMISSION_KEY, handler)).toEqual(['inventory.adjust']);
  });

  it('exposes transfer cancellation only under inventory.transfer', () => {
    const handler = InventoryController.prototype.cancelTransfer;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('transfers/:id/cancel');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PERMISSION_KEY, handler)).toEqual(['inventory.transfer']);
  });
});
