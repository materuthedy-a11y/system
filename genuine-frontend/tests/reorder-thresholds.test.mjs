import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReorderThresholds } from '../lib/inventory/reorder-thresholds.ts';

test('rejects blank threshold fields', () => {
  assert.equal(parseReorderThresholds('', '4'), null);
  assert.equal(parseReorderThresholds('2', ''), null);
  assert.equal(parseReorderThresholds('   ', '4'), null);
});

test('rejects negative, fractional, and inverted thresholds', () => {
  assert.equal(parseReorderThresholds('-1', '4'), null);
  assert.equal(parseReorderThresholds('2.5', '4'), null);
  assert.equal(parseReorderThresholds('5', '4'), null);
});

test('accepts zero and ordered whole-number thresholds', () => {
  assert.deepEqual(parseReorderThresholds('0', '0'), {
    minimumStock: 0,
    reorderLevel: 0,
  });
  assert.deepEqual(parseReorderThresholds('2', '4'), {
    minimumStock: 2,
    reorderLevel: 4,
  });
});
