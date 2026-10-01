import { parseAmount } from './parse.mjs';

export function formatAmount(text) {
  const value = parseAmount(text);
  if (value === undefined) return '0.00';
  return value.toFixed(2);
}
