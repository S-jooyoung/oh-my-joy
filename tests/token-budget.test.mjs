/**
 * Always-on token budget — the surface ratchet.
 *
 * These repository ratchets measure name + description + argument-hint, rounded
 * per entry at characters / 4. They exclude native namespaces, paths, catalog
 * framing, other plugins, and host-specific truncation. Passing does not prove
 * that a host's available-skills catalog will fit its runtime context budget.
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

const CLAUDE_ALWAYS_ON_BUDGET_TOKENS = 1700;
const CODEX_ALWAYS_ON_BUDGET_TOKENS = 600;
const MAINTAINER_BUDGET_TOKENS = 120;
const COMPACT_SKILLS = new Set(['critic', 'design-qa', 'implementer', 'spec']);
const PLUGIN_SKILLS = [
  'critic', 'deep-interview', 'design-qa', 'fix', 'frontend-fundamentals',
  'implementer', 'ralplan', 'review', 'setup', 'ship', 'spec', 'sync',
  'ultragoal', 'verify',
];

const allSkills = listTrackedFiles('skills/*/SKILL.md');
const claudeSurfaces = [
  ...listCommandFiles().map((f) => `commands/${f}`),
  ...listAgentFiles().map((f) => `agents/${f}`),
  ...allSkills,
  ...listTrackedFiles('output-styles/*.md'),
];
const codexSurfaces = allSkills;
const maintainerSurfaces = listTrackedFiles('.agents/skills/*/SKILL.md');

function measure(file, fm) {
  const name = String(fm.name ?? '');
  const description = String(fm.description ?? '');
  const chars = name.length + description.length + String(fm['argument-hint'] ?? '').length;
  return { file, name, description, tokens: Math.round(chars / 4) };
}

function readRows(surfaces) {
  return surfaces.map((file) => measure(file, parseFrontmatter(readRepoFile(file)) ?? {}));
}

function assertInventory(rows, expected) {
  assert.deepEqual(rows.map((row) => row.name).sort(), [...expected].sort(), 'skill inventory changed');
}

function assertDescriptions(rows) {
  for (const row of rows) {
    const limit = COMPACT_SKILLS.has(row.name) ? 120 : 180;
    assert.ok(row.description.trim(), `${row.file}: description is empty`);
    assert.ok(Array.from(row.description).length <= limit, `${row.file}: description exceeds ${limit} characters`);
  }
}

function assertWithinBudget(rows, budget) {
  const total = rows.reduce((sum, row) => sum + row.tokens, 0);
  const table = rows.map((row) => `  ${row.tokens.toString().padStart(4)}  ${row.file}`).join('\n');
  assert.ok(total <= budget, `always-on estimate ${total} tok exceeds the ${budget} tok budget:\n${table}`);
}

describe('Always-on token budget', () => {
  it('enumerates the complete plugin and separate maintainer inventories', () => {
    assertInventory(readRows(codexSurfaces), PLUGIN_SKILLS);
    assertInventory(readRows(maintainerSurfaces), ['release', 'release-checklist']);
    assert.ok(claudeSurfaces.some((file) => file.startsWith('commands/')));
    assert.ok(claudeSurfaces.some((file) => file.startsWith('agents/')));
    assert.ok(claudeSurfaces.some((file) => file.startsWith('output-styles/')));
    assert.ok(maintainerSurfaces.every((file) => !claudeSurfaces.includes(file) && !codexSurfaces.includes(file)));
  });

  it('keeps skill descriptions concise even when the aggregate has room', () => {
    assertDescriptions(readRows([...codexSurfaces, ...maintainerSurfaces]));
  });

  it(`Claude descriptions stay within ${CLAUDE_ALWAYS_ON_BUDGET_TOKENS} estimated tokens`, () => {
    assertWithinBudget(readRows(claudeSurfaces), CLAUDE_ALWAYS_ON_BUDGET_TOKENS);
  });

  it(`Codex descriptions stay within ${CODEX_ALWAYS_ON_BUDGET_TOKENS} estimated tokens`, () => {
    assertWithinBudget(readRows(codexSurfaces), CODEX_ALWAYS_ON_BUDGET_TOKENS);
  });

  it(`repo-local maintainer descriptions stay within ${MAINTAINER_BUDGET_TOKENS} estimated tokens`, () => {
    assertWithinBudget(readRows(maintainerSurfaces), MAINTAINER_BUDGET_TOKENS);
  });

  it('rejects one oversized description despite a passing aggregate', () => {
    const rows = [measure('fixture/SKILL.md', { name: 'review', description: 'x'.repeat(181) })];
    assertWithinBudget(rows, CODEX_ALWAYS_ON_BUDGET_TOKENS);
    assert.throws(() => assertDescriptions(rows), /exceeds 180 characters/);
    assert.throws(() => assertDescriptions([measure('fixture/SKILL.md', { name: 'spec', description: 'x'.repeat(121) })]), /exceeds 120 characters/);
  });

  it('rejects an empty description or an omitted required skill', () => {
    assert.throws(() => assertDescriptions([measure('fixture/SKILL.md', { name: 'review', description: '  ' })]), /description is empty/);
    assert.throws(() => assertInventory(readRows(codexSurfaces).filter((row) => row.name !== 'ship'), PLUGIN_SKILLS), /skill inventory changed/);
  });

  it('does not mix repo-local skills into the consuming plugin budget', () => {
    assert.throws(() => assertInventory(readRows([...codexSurfaces, ...maintainerSurfaces]), PLUGIN_SKILLS), /skill inventory changed/);
  });
});
