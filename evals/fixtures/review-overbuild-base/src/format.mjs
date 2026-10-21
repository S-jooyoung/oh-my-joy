import { parseAmount } from './parse.mjs';

export function formatAmount(text) {
  return parseAmount(text).toFixed(2);
}
