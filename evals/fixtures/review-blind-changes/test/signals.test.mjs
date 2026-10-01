import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const worker = `
process.on('SIGTERM', () => process.exit(0));
console.log('ready');
setInterval(() => {}, 1000);
`;

test('a SIGTERM shuts the worker down cleanly', { skip: process.platform === 'win32' && 'POSIX signals' }, async () => {
  const child = spawn(process.execPath, ['-e', worker]);
  await once(child.stdout, 'data');
  child.kill('SIGTERM');
  const [code] = await once(child, 'exit');
  assert.equal(code, 0);
});
