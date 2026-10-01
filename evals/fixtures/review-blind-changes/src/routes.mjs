import { createServer } from 'node:http';
import { findUser, searchUsers } from './db.mjs';
import { profileName } from './profile.mjs';

export async function handle(request) {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/users/search') {
    const users = await searchUsers(url.searchParams.get('q') ?? '');
    return { status: 200, body: JSON.stringify(users) };
  }
  const nameMatch = /^\/users\/(\d+)\/name$/.exec(url.pathname);
  if (nameMatch) return { status: 200, body: profileName(Number(nameMatch[1])) };
  const userMatch = /^\/users\/(\d+)$/.exec(url.pathname);
  if (userMatch) {
    const user = await findUser(Number(userMatch[1]));
    return user ? { status: 200, body: JSON.stringify(user) } : { status: 404, body: 'not found' };
  }
  return { status: 404, body: 'not found' };
}

export function start(port = 3000) {
  const server = createServer(async (request, response) => {
    const { status, body } = await handle(request);
    response.writeHead(status);
    response.end(body);
  });
  server.listen(port);
  return server;
}
