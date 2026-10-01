import { createServer } from 'node:http';
import { match } from 'path-to-regexp';

const items = new Map([[1, { id: 1, name: 'Notebook' }]]);
const itemRoute = match('/api/items/:id');

export function handle(request) {
  console.log(`${new Date().toISOString()} ${request.method} ${request.url}`);
  if (request.url === '/health') return { status: 200, body: 'ok' };
  const itemMatch = itemRoute(request.url);
  if (itemMatch) {
    const item = items.get(Number(itemMatch.params.id));
    return item ? { status: 200, body: JSON.stringify(item) } : { status: 404, body: 'not found' };
  }
  if (request.url.startsWith('/api/items')) return { status: 200, body: JSON.stringify([{ id: 1 }]) };
  return { status: 404, body: 'not found' };
}

export function start(port = 3000) {
  const server = createServer((request, response) => {
    const { status, body } = handle(request);
    response.writeHead(status);
    response.end(body);
  });
  server.listen(port);
  return server;
}
