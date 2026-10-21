import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAmount } from '../src/format.mjs';

test('formatAmount renders two decimals', () => {
  assert.equal(formatAmount('12'), '12.00');
});
