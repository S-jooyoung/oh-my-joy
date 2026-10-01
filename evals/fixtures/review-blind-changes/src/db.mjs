import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.env.USERS_DB ?? 'users.db');

export async function query(sql, params = []) {
  return db.prepare(sql).all(...params);
}

export async function findUser(id) {
  const [user] = await query('SELECT id, name, email FROM users WHERE id = ?', [id]);
  return user ?? null;
}

export async function searchUsers(term) {
  return query(`SELECT id, name FROM users WHERE name LIKE '%${term}%' ORDER BY name LIMIT 20`);
}
