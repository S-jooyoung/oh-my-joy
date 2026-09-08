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

const CLAUDE_ALWAYS_ON_BUDGET_TOKENS = 2100;
const CODEX_ALWAYS_ON_BUDGET_TOKENS = 1200;

const allSkills = listTrackedFiles('skills/*/SKILL.md');
const claudeSurfaces = [
  ...listCommandFiles().map((f) => `commands/${f}`),
  ...listAgentFiles().map((f) => `agents/${f}`),
  ...allSkills,
  ...listTrackedFiles('output-styles/*.md'),
];
const codexSurfaces = allSkills;

function assertWithinBudget(surfaces, budget) {
  const rows = surfaces.map((file) => {
    const fm = parseFrontmatter(readRepoFile(file)) ?? {};
    const chars = String(fm.name ?? '').length + String(fm.description ?? '').length + String(fm['argument-hint'] ?? '').length;
    return { file, tokens: Math.round(chars / 4) };
  });
  const total = rows.reduce((sum, row) => sum + row.tokens, 0);
  const table = rows.map((row) => `  ${row.tokens.toString().padStart(4)}  ${row.file}`).join('\n');
  assert.ok(total <= budget, `always-on estimate ${total} tok exceeds the ${budget} tok budget:\n${table}`);
}

describe('Always-on token budget', () => {
  it('enumeration covers the plugin surfaces — never silently empty', () => {
    assert.ok(claudeSurfaces.length >= 10, `only ${claudeSurfaces.length} Claude surfaces enumerated`);
    assert.ok(codexSurfaces.length >= 12, `only ${codexSurfaces.length} Codex surfaces enumerated`);
  });

  it(`Claude descriptions stay within ${CLAUDE_ALWAYS_ON_BUDGET_TOKENS} estimated tokens`, () => {
    assertWithinBudget(claudeSurfaces, CLAUDE_ALWAYS_ON_BUDGET_TOKENS);
  });

  it(`Codex descriptions stay within ${CODEX_ALWAYS_ON_BUDGET_TOKENS} estimated tokens`, () => {
    assertWithinBudget(codexSurfaces, CODEX_ALWAYS_ON_BUDGET_TOKENS);
  });
});
