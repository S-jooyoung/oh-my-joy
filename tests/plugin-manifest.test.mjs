/**
 * Structural checks for the plugin manifest, commands, agents, and skills.
 *
 * This repo is a plugin whose "behavior is declared in markdown frontmatter", so
 * a single typo only surfaces at runtime as a permission failure. Everything
 * verified here is statically checkable fact — schema fields, version agreement,
 * filename↔declaration agreement, and this repo's top invariant:
 * "the plugin ships no hooks.json".
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import {
  readJson,
  readRepoFile,
  repoPath,
  listCommandFiles,
  listAgentFiles,
  parseFrontmatter,
} from './helpers/repo.mjs';

const plugin = readJson('.claude-plugin', 'plugin.json');
const marketplace = readJson('.claude-plugin', 'marketplace.json');

/**
 * Commands whose docs declare they cannot side-effect source code — two
 * permission tiers.
 *
 * ZERO_BASH: no shell execution path at all (no write tools, no Task/Agent, and
 *   zero Bash tokens). `/omj` must have no write path that bypasses the
 *   plan-gate (PRINCIPLES ①③); `deep-interview` and `ralplan` are primer/review
 *   commands that only produce a native Plan.
 * REPORT_ONLY: never modifies **source** but uses scoped Bash for observation
 *   and reporting — `ff-review` (reads git diffs), `omj-verify` (launches a
 *   browser, captures; curl includes `.omj/baselines/` download writes, so it is
 *   "source-untouched" rather than write-free, with the write scope enforced by
 *   the body). Bare Bash is already blocked by the all-commands check, so only
 *   write tools are asserted here.
 * `omj-start` (Read and AskUserQuestion only) is deliberately unclassified — its
 *   body's "safe conditions for direct Bash execution" makes the permission
 *   prompt gate part of the design, which contradicts a zero-bash assertion.
 */
const ZERO_BASH_COMMANDS = new Set(['omj.md', 'deep-interview.md', 'ralplan.md']);
const REPORT_ONLY_COMMANDS = new Set(['ff-review.md', 'omj-verify.md']);
const READ_ONLY_COMMANDS = new Set([...ZERO_BASH_COMMANDS, ...REPORT_ONLY_COMMANDS]);

/**
 * "Named methodology/rubric" commands allowed to use unprefixed basenames (the
 * two-axis rule — CLAUDE.md). FE-loop verbs are covered by the `/omj-*` regex;
 * this axis is covered by an allowlist. The list is edited in the same PR that
 * adds a new command, so it is a speed bump rather than a hard block — it pulls
 * accidental unprefixed files into review visibility.
 */
const WORKFLOW_COMMANDS = new Set(['deep-interview.md', 'ff-review.md', 'goal-loop.md', 'ralplan.md']);

describe('plugin.json', () => {
  it('has the required fields', () => {
    for (const field of ['name', 'version', 'description', 'author', 'license']) {
      assert.ok(plugin[field], `plugin.json is missing ${field}`);
    }
  });

  it('version is semver', () => {
    assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  });

  it('$schema points at a live SchemaStore entry', () => {
    // Existence checks alone let a dead URL pass, hollowing out the "editor
    // validation" benefit — the previous anthropic.com URL was a 404. Pinning
    // the canonical URL literal exposes drift.
    assert.equal(plugin.$schema, 'https://json.schemastore.org/claude-code-plugin-manifest.json');
    assert.equal(marketplace.$schema, 'https://json.schemastore.org/claude-code-marketplace.json');
  });

  it('the declared license matches the LICENSE file', () => {
    assert.equal(plugin.license, 'MIT');
    assert.match(readRepoFile('LICENSE'), /MIT License/);
  });
});

describe('marketplace.json', () => {
  it('has the required fields', () => {
    assert.ok(marketplace.name);
    assert.ok(marketplace.owner?.name);
    assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length > 0);
  });

  it('listed plugins point at an existing source', () => {
    for (const entry of marketplace.plugins) {
      assert.ok(entry.name, 'plugins[].name missing');
      assert.ok(entry.source, 'plugins[].source missing');
      assert.ok(existsSync(repoPath(entry.source)), `source path does not exist: ${entry.source}`);
    }
  });

  it('every version surface matches plugin.json — so drift cannot linger silently', () => {
    const entry = marketplace.plugins.find((p) => p.name === plugin.name);
    assert.ok(entry, `marketplace.json has no entry for ${plugin.name}`);

    // The version lives in four places. Checking one lets the other three
    // quietly diverge.
    const surfaces = [
      ['marketplace.plugins[].version', entry.version],
      ['marketplace top-level version', marketplace.version],
      ['package.json version', readJson('package.json').version],
    ];
    for (const [label, actual] of surfaces) {
      assert.equal(actual, plugin.version, `${label} differs from plugin.json (${plugin.version})`);
    }
  });
});

describe('Plugin structure invariants', () => {
  // CLAUDE.md's top rule and the explicitly rejected alternative of PRINCIPLES ⑩.
  // If hooks.json exists, merely enabling the plugin auto-fires hooks in every
  // consuming repo.
  it('the plugin ships no hooks.json (zero-hook)', () => {
    for (const candidate of ['hooks/hooks.json', '.claude-plugin/hooks.json', 'hooks.json']) {
      assert.ok(!existsSync(repoPath(candidate)), `${candidate} existing means repo-wide auto-firing`);
    }
  });

  it('hook script canon lives only in templates/hooks/', () => {
    for (const script of ['check-design-tokens.mjs', 'check-story-exists.mjs']) {
      assert.ok(existsSync(repoPath('templates', 'hooks', script)));
    }
  });

  // A consuming project's cwd has no templates/ — unless the copy source is
  // plugin-root-relative, the opt-in hook install cannot run as written (a defect
  // class hidden in dogfooding, where cwd == plugin root).
  it('omj-setup\'s hook copy step uses a plugin-root-relative source path', () => {
    const body = readRepoFile('commands', 'omj-setup.md');
    assert.ok(
      body.includes('${CLAUDE_PLUGIN_ROOT}/templates/hooks/'),
      'omj-setup.md: the hook copy source needs the ${CLAUDE_PLUGIN_ROOT}/templates/hooks/ form',
    );
  });
});

describe('commands/*.md frontmatter', () => {
  const commands = listCommandFiles();

  it('commands exist', () => {
    assert.ok(commands.length > 0);
  });

  for (const file of commands) {
    describe(file, () => {
      const fm = parseFrontmatter(readRepoFile('commands', file));

      it('has frontmatter', () => {
        assert.ok(fm, `${file} has no frontmatter`);
      });

      it('has a description', () => {
        assert.ok(fm.description?.length > 0);
      });

      it('declares allowed-tools', () => {
        assert.ok(fm['allowed-tools']?.length > 0, `${file} has no allowed-tools declaration`);
        // Written as a YAML list, the doesNotMatch checks below die with an
        // unreadable type error — block it explicitly here.
        assert.equal(typeof fm['allowed-tools'], 'string', `${file}: allowed-tools must be a single comma-separated string`);
      });

      // "Removing a permission IS enforcing a safety gate" (PRINCIPLES ③) is this
      // repo's central claim. Stating it only in docs lets the next editor break
      // it silently, so it is nailed down here.
      it('declares no unscoped bare Bash', () => {
        assert.doesNotMatch(
          fm['allowed-tools'],
          /(^|,\s*)Bash\s*(,|$)/,
          `${file}: bare Bash pre-approves arbitrary shell execution — narrow it to Bash(cmd:*)`,
        );
      });

      // Bash(command:*), Bash(sh -c:*), Bash(npx:*) — when the whole prefix
      // consists of execution-delegating builtins, interpreters, or delegation
      // flags, it is effectively bare-Bash pre-approval (a laundering path that
      // uses scope syntax while approving arbitrary execution). This is a
      // heuristic gate pulling known laundering shapes into review visibility —
      // maintain it knowing it is not a sandbox against variants like
      // `env FOO=1 sh`. Any real target argument (Bash(command -v:*),
      // Bash(npx tsc:*)) passes.
      it('does not scope execution-delegating builtins/interpreters as effectively bare', () => {
        const LAUNDER = new Set([
          'command', 'eval', 'exec', 'source', 'sh', 'bash', 'zsh', 'env', 'xargs',
          'sudo', 'nohup', 'time', 'node', 'npx', 'python', 'python3', 'perl', 'ruby', 'awk',
        ]);
        const DELEGATION_FLAGS = new Set(['-c', '-e', '-exec']);
        for (const token of (fm['allowed-tools'] ?? '').split(',').map((t) => t.trim())) {
          const m = /^Bash\((.+?)(?::\*)?\)$/.exec(token);
          if (!m) continue;
          const words = m[1].trim().split(/\s+/);
          const launders = words.every((w) => LAUNDER.has(w) || DELEGATION_FLAGS.has(w));
          assert.ok(
            !launders,
            `${file}: Bash(${m[1]}) is effectively bare Bash — narrow to a real target argument (e.g. Bash(command -v:*))`,
          );
        }
      });

      if (READ_ONLY_COMMANDS.has(file)) {
        // Task/Agent are blocked alongside write tools because subagents do not
        // inherit the parent's allowed-tools — one summoning declaration voids
        // the read-only contract at the manifest level.
        it('read-only commands declare no write tools or subagent summoning', () => {
          assert.doesNotMatch(
            fm['allowed-tools'],
            /(^|,\s*)(Write|Edit|MultiEdit|NotebookEdit|Task|Agent)\b/,
            `${file} is a read-only contract but declares write tools or Task/Agent`,
          );
        });
      }

      if (ZERO_BASH_COMMANDS.has(file)) {
        // The Bash half of the "read-only (no Write/Edit/Bash)" claim — without
        // this assertion, a single scoped Bash could quietly break the contract
        // and no test would fail.
        it('zero-bash commands declare no Bash scope of any kind', () => {
          assert.doesNotMatch(
            fm['allowed-tools'],
            /(^|,\s*)Bash\b/,
            `${file} is a zero-bash contract but declares a Bash token`,
          );
        });
      }

      it('honors the two-axis namespace rule (/omj·/omj-* or the workflow allowlist)', () => {
        assert.ok(
          /^omj(-[a-z-]+)?\.md$/.test(file) || WORKFLOW_COMMANDS.has(file),
          `${file}: FE commands need the omj-* prefix; workflow commands must be listed in WORKFLOW_COMMANDS`,
        );
      });
    });
  }
});

describe('agents/*.md frontmatter', () => {
  // Loop-based checks all pass vacuously when the directory is empty — the
  // existence assertion closes that hole.
  it('the three bundled agents exist', () => {
    assert.ok(listAgentFiles().length >= 3, 'agents/ must carry the bundled trio (figma-implementer, design-qa, plan-critic)');
  });

  for (const file of listAgentFiles()) {
    describe(file, () => {
      const fm = parseFrontmatter(readRepoFile('agents', file));

      it('name matches the filename', () => {
        assert.ok(fm, `${file} has no frontmatter`);
        assert.equal(fm.name, file.replace(/\.md$/, ''));
      });

      it('has description and tools', () => {
        assert.ok(fm.description?.length > 0);
        assert.ok(fm.tools?.length > 0);
        assert.equal(typeof fm.tools, 'string', `${file}: tools must be a single comma-separated string`);
      });
    });
  }

  // Agent tool contracts — the assertion that makes the "tool surface is pinned
  // by tests" claim of ralplan.md and the CHANGELOG actually true. Without it the
  // contract is declaration-only and regressions are silent.
  it('plan-critic\'s tool surface is exactly Read, Grep, Glob (read-only adversarial reviewer)', () => {
    const fm = parseFrontmatter(readRepoFile('agents', 'plan-critic.md'));
    assert.deepEqual(
      fm.tools.split(',').map((t) => t.trim()).sort(),
      ['Glob', 'Grep', 'Read'],
      'plan-critic is a read-only contract — adding a tool is a decision that changes ralplan\'s consensus trust model',
    );
  });

  // Residual hole: this assertion cannot see bare Bash in tools (agent tools have
  // no scope syntax). "Source-untouched" is a contract upheld by the absence of
  // write tools plus body discipline, not a sandbox — keep the README's design-qa
  // description at the same level of precision.
  it('design-qa declares no write tools (inspection only, source untouched)', () => {
    const fm = parseFrontmatter(readRepoFile('agents', 'design-qa.md'));
    assert.doesNotMatch(
      fm.tools,
      /(^|,\s*)(Write|Edit|MultiEdit|NotebookEdit)\b/,
      'design-qa is inspection-only — a write tool would break the "inspects only" contract',
    );
  });
});

/**
 * Tool declaration invariants — introduced after the same defect class recurred
 * three times (ralplan 2026-08).
 * (a) MCP double prefix: v0.4.0 fixed "the tool name differs by install source"
 *     for playwright but the fix never propagated to figma/context7 — because no
 *     test existed.
 * (b) Permission declarations without a call site: three were removed in v0.4.0
 *     and they crept back in.
 *     This check is **mention-based** (any word-boundary occurrence of the
 *     command string in the body passes) — maintain it knowing it is a
 *     diligence-dependent gate, not a structural assertion. Substring matching
 *     went vacuous via coincidental hits in prose ("command" etc.), so it was
 *     hardened to a word-boundary regex.
 */
describe('Tool declaration invariants (commands allowed-tools · agents tools)', () => {
  const surfaces = [
    ...listCommandFiles().map((f) => ({
      file: `commands/${f}`,
      source: readRepoFile('commands', f),
      field: 'allowed-tools',
    })),
    // Agents use the tools: field. Current agents declare only bare Bash, so (b)
    // matching 0 entries is normal (agent tools have no scoped-Bash syntax) — do
    // not mistake the vacuous pass for a regression.
    ...listAgentFiles().map((f) => ({
      file: `agents/${f}`,
      source: readRepoFile('agents', f),
      field: 'tools',
    })),
  ];

  const parsed = surfaces
    .map(({ file, source, field }) => {
      const fm = parseFrontmatter(source);
      const decl = fm?.[field];
      if (!decl) return null;
      return {
        file,
        tokens: decl.split(',').map((t) => t.trim()).filter(Boolean),
        body: source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''),
      };
    })
    .filter(Boolean);

  it('plugin-prefixed MCP declarations also carry the bare server variant', () => {
    const violations = [];
    for (const { file, tokens } of parsed) {
      for (const token of tokens) {
        const m = /^mcp__plugin_(.+)__([A-Za-z0-9_*-]+)$/.exec(token);
        if (!m) continue;
        // The bare name comes from the **MCP server**, not the plugin — the last
        // `_` segment of `mcp__plugin_<plugin>_<server>__` is the server.
        // Assumption: server names contain no `_` (all current servers — figma,
        // context7, playwright — are safe).
        const server = m[1].split('_').pop();
        const tool = m[2];
        const ok =
          tokens.includes(`mcp__${server}__*`) ||
          (tool !== '*' && tokens.includes(`mcp__${server}__${tool}`));
        if (!ok) violations.push(`${file}: ${token} → needs the bare mcp__${server}__${tool === '*' ? '*' : tool} variant alongside`);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `raw MCP registration (claude mcp add) users have no plugin-prefixed tool names and lose pre-approval:\n${violations.join('\n')}`,
    );
  });

  it('bare MCP declarations also carry the plugin-prefixed variant (reverse direction)', () => {
    // Checking only the forward direction (plugin→bare) lets a file that declares
    // only bare tokens pass — plugin-marketplace installs only have
    // plugin-prefixed tool names, so those users lose pre-approval.
    // The server set is built dynamically as "servers declared plugin-prefixed
    // anywhere in the repo" ∪ a known list. Limitation: a new server declared
    // bare-only, with no plugin variant in any file, silences this check — update
    // the known list when adding a new MCP server.
    const KNOWN_SERVERS = new Set(['figma', 'context7', 'playwright']);
    for (const { tokens } of parsed) {
      for (const token of tokens) {
        const pm = /^mcp__plugin_(.+)__/.exec(token);
        if (pm) KNOWN_SERVERS.add(pm[1].split('_').pop());
      }
    }
    const violations = [];
    for (const { file, tokens } of parsed) {
      for (const token of tokens) {
        const m = /^mcp__([A-Za-z0-9-]+)__([A-Za-z0-9_*-]+)$/.exec(token);
        if (!m || !KNOWN_SERVERS.has(m[1])) continue;
        const [, server, tool] = m;
        const ok = tokens.some((t) => {
          const pm = /^mcp__plugin_(.+)__([A-Za-z0-9_*-]+)$/.exec(t);
          if (!pm || pm[1].split('_').pop() !== server) return false;
          return pm[2] === '*' || pm[2] === tool;
        });
        if (!ok) violations.push(`${file}: ${token} → needs the mcp__plugin_*_${server}__ variant alongside`);
      }
    }
    assert.deepEqual(violations, [], `double-prefix pairing must go both ways:\n${violations.join('\n')}`);
  });

  it('Bash declarations have a call site in the body (frontmatter excluded)', () => {
    const violations = [];
    for (const { file, tokens, body } of parsed) {
      for (const token of tokens) {
        const m = /^Bash\((.+)\)$/.exec(token);
        if (!m) continue;
        const cmd = m[1].replace(/:\*$/, '');
        // Word-boundary matching — stops a `command` declaration passing via the
        // "command" fragment in prose. The trailing boundary is required only
        // when cmd ends in a word character (`git add` vs `git addendum`) — a
        // prefix ending in a non-word character is legitimately continued by a
        // filename.
        const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const boundaryAfter = /[\w-]$/.test(cmd) ? '(?![\\w-])' : '';
        const callSite = new RegExp(`(^|[^\\w-])${escaped}${boundaryAfter}`);
        if (!callSite.test(body)) violations.push(`${file}: Bash(${m[1]}) — no call site "${cmd}" in the body`);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `tools without a call site in the body's procedure must not be declared (CLAUDE.md):\n${violations.join('\n')}`,
    );
  });
});

describe('skills/frontend-fundamentals', () => {
  const fm = parseFrontmatter(readRepoFile('skills', 'frontend-fundamentals', 'SKILL.md'));

  it('has name, description, and license', () => {
    assert.equal(fm.name, 'frontend-fundamentals');
    assert.ok(fm.description?.length > 0);
    assert.equal(fm.license, 'MIT');
  });

  it('nested metadata parses intact', () => {
    assert.equal(typeof fm.metadata, 'object');
    assert.match(fm.metadata.version, /^\d+\.\d+\.\d+$/);
    assert.ok(fm.metadata.author?.length > 0);
  });

  it('every references/ file SKILL.md links to exists', () => {
    const source = readRepoFile('skills', 'frontend-fundamentals', 'SKILL.md');
    const referenced = [...source.matchAll(/\(references\/([\w-]+\.md)\)/g)].map((m) => m[1]);
    assert.ok(referenced.length > 0, 'no references links found');

    for (const name of new Set(referenced)) {
      assert.ok(
        existsSync(repoPath('skills', 'frontend-fundamentals', 'references', name)),
        `references/${name} does not exist`,
      );
    }
  });
});
