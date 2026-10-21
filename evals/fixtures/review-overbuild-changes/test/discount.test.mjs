import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDiscount } from '../src/discount.mjs';

test('applies a percentage and rounds to cents', () => {
  assert.equal(applyDiscount(19.99, 15), 16.99);
});

test('rejects a percentage outside 0-100', () => {
  assert.throws(() => applyDiscount(10, 101), RangeError);
});
