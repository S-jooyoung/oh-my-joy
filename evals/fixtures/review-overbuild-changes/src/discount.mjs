export function applyDiscount(amount, percent) {
  if (percent < 0 || percent > 100) throw new RangeError(`percent out of range: ${percent}`);
  return Math.round(amount * (100 - percent)) / 100;
}
