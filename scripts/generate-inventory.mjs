#!/usr/bin/env node
/**
 * generate-inventory — deterministic content manifest of the shipped plugin surface.
 *
 * Fixes "what is deployed" as a single sha256 over the sorted file list plus each
 * file's content hash. The release workflow records it in the GitHub Release notes
 * at tag time and re-verifies the tag's tree against it afterwards, so "what was
 * released" and "what the tag contains" cannot silently diverge (the drift class
 * the release-checklist skill otherwise diagnoses by hand).
 *
 * Modes: the default hashes the git-tracked tree of the cwd (repo or tag checkout);
 * `--dir <path>` walks a plain directory (e.g. an installed plugin cache) with
 * .git/node_modules/.omc/.omj excluded, so a local install can be compared against
 * a published release hash.
 *
 * Determinism contract: byte-order path sort, content-only hashing, no timestamps —
 * the same tree must always produce the same sha256 (pinned by
 * tests/generate-inventory.test.mjs).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.omc', '.omj']);
const EXCLUDED_FILES = new Set(['.DS_Store']);

export function listDirFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (entry.isFile() && !EXCLUDED_FILES.has(entry.name)) {
        files.push(path.relative(root, path.join(dir, entry.name)));
      }
    }
  };
  walk(root);
  // Normalize to git's separator so repo mode and --dir mode hash identical trees identically.
  return files.map((file) => file.split(path.sep).join('/'));
}

const listTrackedFiles = (root) =>
  execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

export function buildInventory(root, files) {
  // Default array sort (UTF-16 code-unit order) — locale-dependent collation would
  // break cross-machine reproducibility.
  const sorted = [...files].sort();
  const hash = createHash('sha256');
  for (const file of sorted) {
    hash.update(`${file}\0`);
    hash.update(createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex'));
    hash.update('\n');
  }

  const manifestPath = path.join(root, '.claude-plugin', 'plugin.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;

  return {
    schema_version: 1,
    plugin: manifest?.name ?? null,
    version: manifest?.version ?? null,
    files: sorted.length,
    sha256: hash.digest('hex'),
  };
}

function main() {
  const args = process.argv.slice(2);
  const dirIndex = args.indexOf('--dir');
  const dir = dirIndex !== -1 ? args[dirIndex + 1] : null;
  if (dirIndex !== -1 && !dir) {
    process.stderr.write('generate-inventory: --dir requires a path\n');
    process.exit(1);
  }

  const root = dir ? path.resolve(dir) : process.cwd();
  const files = dir ? listDirFiles(root) : listTrackedFiles(root);
  if (files.length === 0) {
    process.stderr.write(`generate-inventory: no files found under ${root}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(buildInventory(root, files), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
