/**
 * Always-on token budget — the surface ratchet.
 *
 * Every command, agent, skill, and output-style description is loaded into every
 * session whether or not it fires (`claude plugin details` calls this the
 * always-on cost). Surfaces grow one "small" addition at a time, so the total is
 * pinned here: adding a command means either trimming descriptions elsewhere or
 * raising the budget in a reviewed commit. Characters ÷ 4 approximates tokens
 * closely enough for a ratchet; the number is not a billing figure.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  readRepoFile,
  listCommandFiles,
  listAgentFiles,
  listTrackedFiles,
  parseFrontmatter,
} from './helpers/repo.mjs';

const ALWAYS_ON_BUDGET_TOKENS = 1200;

const surfaces = [
  ...listCommandFiles().map((f) => `commands/${f}`),
  ...listAgentFiles().map((f) => `agents/${f}`),
  ...listTrackedFiles('skills/*/SKILL.md'),
  ...listTrackedFiles('output-styles/*.md'),
];

describe('Always-on token budget', () => {
  it('enumeration covers the plugin surfaces — never silently empty', () => {
    assert.ok(surfaces.length >= 10, `only ${surfaces.length} surfaces enumerated`);
  });

  it(`descriptions stay within ${ALWAYS_ON_BUDGET_TOKENS} estimated tokens`, () => {
    const rows = surfaces.map((file) => {
      const fm = parseFrontmatter(readRepoFile(file)) ?? {};
      const chars = String(fm.name ?? '').length + String(fm.description ?? '').length + String(fm['argument-hint'] ?? '').length;
      return { file, tokens: Math.round(chars / 4) };
    });
    const total = rows.reduce((sum, row) => sum + row.tokens, 0);
    const table = rows.map((row) => `  ${row.tokens.toString().padStart(4)}  ${row.file}`).join('\n');
    assert.ok(
      total <= ALWAYS_ON_BUDGET_TOKENS,
      `always-on estimate ${total} tok exceeds the ${ALWAYS_ON_BUDGET_TOKENS} tok budget:\n${table}`,
    );
  });
});
