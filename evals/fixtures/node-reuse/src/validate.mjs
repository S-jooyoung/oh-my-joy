export function isEmail(text) {
  return typeof text === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}
