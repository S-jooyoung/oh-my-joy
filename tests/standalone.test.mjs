/**
 * Standalone invariants — "OMJ ships with zero runtime coupling".
 *
 * Earlier releases guaranteed independence from external orchestrators by
 * requiring every runtime mention to name a fallback. The orchestrator
 * integration has since been removed entirely, so the guarantee strengthens:
 * outside preserved history (CHANGELOG) and attribution (NOTICE), no tracked
 * markdown may mention an external runtime at all — reintroducing one must be
 * a deliberate, reviewed decision, not drift.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  readJson,
  readRepoFile,
  listMarkdownFiles,
  listTrackedFiles,
} from './helpers/repo.mjs';

/** External orchestrator vocabulary that must not reappear in tracked docs. */
const RUNTIME_MENTION = /\bOMC\b|\bOMX\b|oh-my-claudecode|oh-my-codex|\$ultragoal|\$ralph\b|\$team\b|\$ultraqa|\$ralplan\b/;
// hud/README.md is attribution for the vendored HUD bundle (NOTICE.md names the source) —
// the same history/attribution class as NOTICE.md, not an orchestrator integration.
const RUNTIME_EXEMPT = new Set(['CHANGELOG.md', 'NOTICE.md', 'hud/README.md']);

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

describe('standalone: no external-runtime coupling remains', () => {
  it('tracked markdown mentions no external orchestrator (history and attribution exempt)', () => {
    const offenders = [];
    for (const file of listMarkdownFiles()) {
      if (RUNTIME_EXEMPT.has(file)) continue;
      if (RUNTIME_MENTION.test(readRepoFile(file))) offenders.push(file);
    }
    assert.deepEqual(
      offenders,
      [],
      `external orchestrator mentions found — the integration was removed, so these are drift:\n${offenders.join('\n')}`,
    );
  });

  it('the routing SoT defines all four lanes', () => {
    const handoff = readRepoFile('docs', 'EXECUTION-HANDOFF.md');
    for (const lane of ['inline', '`/goal`', 'agent team', '/oh-my-joy:goal-loop']) {
      assert.ok(
        handoff.includes(lane),
        `docs/EXECUTION-HANDOFF.md must define the "${lane}" lane — it is the single routing SoT`,
      );
    }
  });

  it('the routing SoT names the consensus pass', () => {
    assert.match(
      readRepoFile('docs', 'EXECUTION-HANDOFF.md'),
      /\/oh-my-joy:ralplan/,
      'EXECUTION-HANDOFF.md must name /oh-my-joy:ralplan as the pre-approval consensus pass',
    );
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
