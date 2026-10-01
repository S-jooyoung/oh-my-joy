import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findItem, lookupAll } from '../src/items.mjs';

const items = [{ id: 'a', price: 1 }, { id: 'b', price: 2 }];

test('findItem returns the matching item or null', () => {
  assert.deepEqual(findItem(items, 'b'), { id: 'b', price: 2 });
  assert.equal(findItem(items, 'z'), null);
});

test('lookupAll keeps the order of the requested ids', () => {
  assert.deepEqual(lookupAll(items, ['b', 'a', 'z']), [items[1], items[0], null]);
});
