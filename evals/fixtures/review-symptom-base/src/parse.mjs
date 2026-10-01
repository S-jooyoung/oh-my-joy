export function parseAmount(text) {
  const value = Number(text);
  return Number.isNaN(value) ? undefined : value;
}
