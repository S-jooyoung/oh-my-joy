/**
 * Standalone invariants — "OMJ runs fully without OMC/OMX installed".
 *
 * The plugin's independence is currently guaranteed only by prose in
 * README/PRINCIPLES/EXECUTION-HANDOFF. Prose does not fail a build, so a future
 * edit could reintroduce a hard runtime dependency (an `omx …` shell call with no
 * fallback, an npm dependency, a lane with no no-runtime row) and every existing
 * test would still pass.
 *
 * These checks turn that prose into a gate. They are deliberately structural —
 * they verify the *escape hatch exists*, not that any particular wording is used.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  readJson,
  readRepoFile,
  listCommandFiles,
  listAgentFiles,
  listTrackedFiles,
  stripCode,
} from './helpers/repo.mjs';

/** Optional-integration runtimes. Mentioning them is fine; *requiring* them is not. */
const RUNTIME_MENTION = /\bOMC\b|\bOMX\b|oh-my-claudecode|oh-my-codex|\$ultragoal|\$ralph\b|\$team\b|\$ultraqa/;

/**
 * A file that mentions a runtime must also name an escape hatch reachable
 * without it: an OMJ-native command, or an explicit manual/copyable path.
 */
const FALLBACK_SIGNAL = /\/oh-my-joy:(goal-loop|ralplan|deep-interview|ff-review)|\/omj-|manual|copyable|without OMC|no runtime|No runtime/i;

describe('standalone: zero runtime dependencies', () => {
  it('package.json declares no dependencies of any kind', () => {
    const pkg = readJson('package.json');
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      assert.equal(
        pkg[field],
        undefined,
        `package.json must stay dependency-free — found "${field}". The plugin and its ` +
          'verification harness both run on Node built-ins only, which is what lets CI ' +
          'skip an install step entirely.',
      );
    }
  });

  it('no lockfile is committed (nothing to install, nothing to drift)', () => {
    const lockfiles = listTrackedFiles(
      'package-lock.json',
      'npm-shrinkwrap.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'bun.lockb',
    );
    assert.deepEqual(lockfiles, [], `Unexpected lockfile(s): ${lockfiles.join(', ')}`);
  });

  it('every shipped script imports Node built-ins only', () => {
    const scripts = listTrackedFiles('scripts/*.mjs', 'templates/hooks/*.mjs', 'tests/**/*.mjs');
    assert.ok(scripts.length > 0, 'expected shipped .mjs scripts to exist');

    for (const file of scripts) {
      const source = readRepoFile(file);
      const specifiers = [...source.matchAll(/^\s*import\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)].map(
        (m) => m[1],
      );
      for (const specifier of specifiers) {
        const isBuiltin = specifier.startsWith('node:');
        const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
        assert.ok(
          isBuiltin || isRelative,
          `${file} imports "${specifier}" — only "node:*" built-ins and relative paths are allowed. ` +
            'A bare specifier would make the plugin need an install step.',
        );
      }
    }
  });
});

describe('standalone: every runtime integration has a no-runtime path', () => {
  const handoff = readRepoFile('docs', 'EXECUTION-HANDOFF.md');

  it('the routing SoT carries an explicit no-runtime row', () => {
    assert.match(
      handoff,
      /\|\s*No runtime\s*\|/,
      'docs/EXECUTION-HANDOFF.md must keep a "No runtime" row in its syntax map — it is the ' +
        'single place that states what a user without OMC/OMX gets for each lane.',
    );
  });

  it('the no-runtime row routes durable work to the OMJ-native lane', () => {
    const row = /\|\s*No runtime\s*\|([^\n]*)\|/.exec(handoff);
    assert.ok(row, 'no-runtime row not found');
    assert.match(
      row[1],
      /\/oh-my-joy:goal-loop/,
      'the no-runtime durable wrapper must be the OMJ-native goal-loop, not a runtime command',
    );
  });

  it('the no-runtime consensus fallback is the OMJ-native critic', () => {
    assert.match(
      handoff,
      /\/oh-my-joy:ralplan/,
      'EXECUTION-HANDOFF.md must name /oh-my-joy:ralplan as the consensus lane reachable without a runtime',
    );
  });

  it('commands and agents that mention a runtime also name a fallback', () => {
    const surfaces = [
      ...listCommandFiles().map((f) => `commands/${f}`),
      ...listAgentFiles().map((f) => `agents/${f}`),
    ];

    for (const file of surfaces) {
      const body = stripCode(readRepoFile(file));
      if (!RUNTIME_MENTION.test(body)) continue;
      assert.match(
        readRepoFile(file),
        FALLBACK_SIGNAL,
        `${file} mentions OMC/OMX but names no path that works without it. Every runtime ` +
          'integration must degrade to an OMJ-native command or an explicit manual action ' +
          '(graceful degradation — PRINCIPLES ⑨).',
      );
    }
  });
});

describe('standalone: the durable lane is self-hosted', () => {
  it('goal-loop pre-approves only the bundled validator, never a runtime CLI', () => {
    const body = readRepoFile('commands', 'goal-loop.md');
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(body);
    assert.ok(frontmatter, 'goal-loop.md must have frontmatter');

    assert.doesNotMatch(
      frontmatter[1],
      /\bomx\b|\bomc\b/i,
      'goal-loop must not pre-approve an external runtime CLI — its durable state is owned by ' +
        'the bundled scripts/goal-state.mjs validator.',
    );
    assert.match(
      frontmatter[1],
      /goal-state\.mjs/,
      'goal-loop must pre-approve the bundled goal-state.mjs validator',
    );
  });

  it('the validator is committed and executable as a plain Node script', () => {
    const source = readRepoFile('scripts', 'goal-state.mjs');
    assert.match(source, /^#!\/usr\/bin\/env node/, 'goal-state.mjs must carry a node shebang');
    assert.match(
      source,
      /SCHEMA_VERSION/,
      'goal-state.mjs must own a schema version — the state contract is OMJ-local, not borrowed',
    );
  });
});
