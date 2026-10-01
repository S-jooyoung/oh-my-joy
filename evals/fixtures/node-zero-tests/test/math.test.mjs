import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, clamp } from '../src/math.mjs';

test('add sums two numbers', () => {
  assert.equal(add(2, 3), 5);
});

test('clamp keeps a value inside the range', () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(-1, 0, 10), 0);
});
