export function parseQuantity(text) {
  const value = Number(String(text).trim());
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`invalid quantity: ${text}`);
  }
  return value;
}
