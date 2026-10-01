import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? collect(file) : [file];
  });
}

const files = collect('test').filter((file) => file.endsWith('.spec.mjs'));

if (files.length === 0) {
  console.log('# tests 0');
  console.log('# pass 0');
  console.log('# fail 0');
  process.exit(0);
}

const run = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(run.status ?? 1);
