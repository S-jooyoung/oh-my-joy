import { createServer } from 'node:http';

export function handle(request) {
  if (request.url === '/health') return { status: 200, body: 'ok' };
  if (request.url === '/api/time') return { status: 200, body: JSON.stringify({ now: Date.now() }) };
  const item = /^\/api\/items\/(\d+)$/.exec(request.url);
  if (item) return { status: 200, body: JSON.stringify({ id: Number(item[1]), createdAt: new Date().toISOString() }) };
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
