export function parseName(input) {
  const [last, first] = input.split(',').map((part) => part.trim());
  return { first, last };
}
