/**
 * generate-inventory determinism contract.
 *
 * The release verify job trusts this script's sha256 as the drift detector, so the
 * suite pins exactly two properties: the same tree always hashes the same
 * (reproducibility across runs and machines), and any content change hashes
 * differently (drift detection). Operational noise (.git, node_modules, .omc, .omj)
 * must not influence the hash, or a local cache could never match a fresh checkout.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { makeProject, readJson, repoPath, REPO_ROOT } from './helpers/repo.mjs';

const runInventory = (...args) =>
  JSON.parse(execFileSync('node', [repoPath('scripts', 'generate-inventory.mjs'), ...args], { encoding: 'utf8' }));

const FIXTURE = {
  'commands/spec.md': '# spec\n',
  'agents/helper.md': '# helper\n',
  '.claude-plugin/plugin.json': '{"name":"fixture","version":"1.0.0"}\n',
};

describe('generate-inventory', () => {
  it('the same tree produces the same sha256 (deterministic)', () => {
    const project = makeProject(FIXTURE);
    try {
      const first = runInventory('--dir', project.root);
      const second = runInventory('--dir', project.root);
      assert.equal(first.sha256, second.sha256);
      assert.equal(first.files, 3);
      assert.equal(first.plugin, 'fixture');
      assert.equal(first.version, '1.0.0');
    } finally {
      project.cleanup();
    }
  });

  it('a one-file content change produces a different sha256 (drift detection)', () => {
    const project = makeProject(FIXTURE);
    try {
      const before = runInventory('--dir', project.root).sha256;
      writeFileSync(project.file('commands/spec.md'), '# spec (edited)\n');
      const after = runInventory('--dir', project.root).sha256;
      assert.notEqual(before, after);
    } finally {
      project.cleanup();
    }
  });

  it('operational directories do not influence the hash', () => {
    const clean = makeProject(FIXTURE);
    const noisy = makeProject({
      ...FIXTURE,
      '.git/HEAD': 'ref: refs/heads/main\n',
      'node_modules/x/index.js': 'x\n',
      '.omc/state/team-state.json': '{}\n',
      '.omj/goals/x/goals.json': '{}\n',
      '.DS_Store': 'noise\n',
    });
    try {
      assert.equal(
        runInventory('--dir', clean.root).sha256,
        runInventory('--dir', noisy.root).sha256,
      );
    } finally {
      clean.cleanup();
      noisy.cleanup();
    }
  });

  it('repo mode hashes the tracked tree and binds the manifest version', () => {
    const inventory = JSON.parse(
      execFileSync('node', [repoPath('scripts', 'generate-inventory.mjs')], { cwd: REPO_ROOT, encoding: 'utf8' }),
    );
    assert.equal(inventory.plugin, 'oh-my-joy');
    assert.equal(inventory.version, readJson('.claude-plugin', 'plugin.json').version);
    assert.ok(inventory.files > 20, `only ${inventory.files} tracked files hashed`);
    assert.match(inventory.sha256, /^[0-9a-f]{64}$/);
  });
});
