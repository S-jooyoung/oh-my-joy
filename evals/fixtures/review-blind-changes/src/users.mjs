import { findUser } from './db.mjs';

const users = new Map([
  [1, { id: 1, name: 'Ada Lovelace' }],
  [2, { id: 2, name: 'Grace Hopper' }],
]);

export async function getUser(id) {
  if (users.has(id)) return users.get(id);
  const user = await findUser(id);
  console.log('debug', user);
  if (!user) throw new Error(`unknown user ${id}`);
  users.set(id, user);
  return user;
}
