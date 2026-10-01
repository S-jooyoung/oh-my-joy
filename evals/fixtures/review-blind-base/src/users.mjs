const users = new Map([
  [1, { id: 1, name: 'Ada Lovelace' }],
  [2, { id: 2, name: 'Grace Hopper' }],
]);

export function getUser(id) {
  const user = users.get(id);
  if (!user) throw new Error(`unknown user ${id}`);
  return user;
}
