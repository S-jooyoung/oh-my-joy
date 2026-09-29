import { lookupAll } from '../src/items.mjs';

let seed = 42;
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const items = Array.from({ length: 5000 }, (_, index) => ({ id: `item-${index}`, price: Math.floor(random() * 1000) }));
const ids = Array.from({ length: 5000 }, () => `item-${Math.floor(random() * 5000)}`);

const started = performance.now();
for (let round = 0; round < 3; round += 1) lookupAll(items, ids);
console.log(`METRIC lookup_ms=${(performance.now() - started).toFixed(2)}`);
