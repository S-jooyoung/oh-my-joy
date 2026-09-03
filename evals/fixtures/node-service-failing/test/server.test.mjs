import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/server.mjs';

test('unknown route returns 410 (intentionally wrong expectation)', () => {
  assert.equal(handle({ url: '/nope' }).status, 410);
});
