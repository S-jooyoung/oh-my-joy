export function parseName(input) {
  if (!input.includes(',')) {
    const [first, ...rest] = input.trim().split(/\s+/);
    return { first, last: rest.join(' ') };
  }
  const [last, first] = input.split(',').map((part) => part.trim());
  return { first, last };
}
