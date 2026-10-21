import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmail } from '../src/validate.mjs';

test('accepts a plain address', () => {
  assert.equal(isEmail('ok@example.com'), true);
});

test('rejects text without a domain', () => {
  assert.equal(isEmail('nobody'), false);
});
