#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const [, , inputPath, outputPath] = process.argv;

async function main() {
  if (inputPath) {
    if (outputPath) {
      const raw = await readFile(inputPath, 'utf8');
      const orders = JSON.parse(raw);
      if (Array.isArray(orders)) {
        const synced = [];
        for (const order of orders) {
          if (order.status !== 'cancelled') {
            if (order.total > 0) {
              if (order.items && order.items.length > 0) {
                synced.push({ id: order.id, total: order.total, itemCount: order.items.length });
              } else {
                console.warn(`skip ${order.id}: no items`);
              }
            } else {
              console.warn(`skip ${order.id}: zero total`);
            }
          }
        }
        await writeFile(outputPath, JSON.stringify(synced, null, 2));
        console.log(`synced ${synced.length} of ${orders.length} orders`);
      } else {
        console.error('input must be a JSON array');
        process.exit(1);
      }
    } else {
      console.error('usage: sync-orders <input.json> <output.json>');
      process.exit(1);
    }
  } else {
    console.error('usage: sync-orders <input.json> <output.json>');
    process.exit(1);
  }
}

main();
