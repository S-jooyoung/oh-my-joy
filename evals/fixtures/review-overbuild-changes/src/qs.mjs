export function parseQueryString(input) {
  const result = {};
  const query = input.startsWith('?') ? input.slice(1) : input;
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const index = pair.indexOf('=');
    const key = index === -1 ? pair : pair.slice(0, index);
    const value = index === -1 ? '' : pair.slice(index + 1);
    result[decodeURIComponent(key.replace(/\+/g, ' '))] = decodeURIComponent(value.replace(/\+/g, ' '));
  }
  return result;
}
