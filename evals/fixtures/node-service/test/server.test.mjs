import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/server.mjs';

test('health returns 200', () => {
  assert.equal(handle({ url: '/health' }).status, 200);
});
