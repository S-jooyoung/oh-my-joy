export function findItem(items, id) {
  return items.find((item) => item.id === id) ?? null;
}

export function lookupAll(items, ids) {
  return ids.map((id) => findItem(items, id));
}
