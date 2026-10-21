export function formatMoney(text) {
  const value = Number(text);
  if (Number.isNaN(value)) return undefined;
  return value.toFixed(2);
}
