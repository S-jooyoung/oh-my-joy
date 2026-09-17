import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatName } from '../src/lib/format.mjs';

test('formats last name first', () => {
  assert.equal(formatName('Ada', 'Lovelace'), 'Lovelace, Ada');
});

test('trims surrounding spaces', () => {
  assert.equal(formatName(' Ada ', ' Lovelace '), 'Lovelace, Ada');
});
