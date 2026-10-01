import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuantity } from '../src/quantity.mjs';

test('parseQuantity reads a whole number', () => {
  assert.equal(parseQuantity('3'), 3);
});
