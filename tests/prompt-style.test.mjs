/**
 * Prompt-style invariants — the official Anthropic prompting guide, pinned.
 *
 * Every command, agent, skill, and output-style body is a prompt Claude reads on
 * each invocation. The guide's advice (be clear and give the reason; say what to
 * do instead of shouting what not to do; separate examples from instructions
 * with <example> tags; avoid emphasis inflation that makes models overtrigger)
 * held for one release and then drifted back, so the mechanically checkable part
 * lives here. The rewrite that established these budgets is v0.8.0.
 *
 * The body budget below ratchets the size of every command, agent, and skill
 * body (the part loaded on invocation); tests/token-budget.test.mjs ratchets the
 * always-on descriptions.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  readRepoFile,
  listCommandFiles,
  listAgentFiles,
  listTrackedFiles,
  stripCode,
} from './helpers/repo.mjs';

const targets = [
  ...listCommandFiles().map((f) => `commands/${f}`),
  ...listAgentFiles().map((f) => `agents/${f}`),
  ...listTrackedFiles('skills/*/SKILL.md'),
  ...listTrackedFiles('output-styles/*.md'),
  ...listTrackedFiles('.claude/commands/*.md', '.claude/skills/*/SKILL.md', '.agents/skills/*/SKILL.md'),
];

const body = (source) => source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

// Shouted imperatives: current models follow "Use X when…" as reliably as
// "CRITICAL: You MUST use X", and the shouting makes them overtrigger.
const SHOUTED = /\b(MUST|NEVER|ALWAYS|MANDATORY|CRITICAL|FORBIDDEN)\b/g;
// Ten bold spans is plenty for one body; past that, emphasis stops meaning anything.
const BOLD_MARKER_BUDGET = 20;
// Callout glyphs (⚠ ✅ ℹ ⚙ ❌ ➖ ✓ ✗ 🚫 💡) are decoration in a prompt. The
// severity triad 🔴🟡🟢 is an output contract and stays allowed.
const CALLOUTS = /[⚠✅ℹ⚙❌➖✓✗\u{1F6AB}\u{1F4A1}]/gu;
// Circled numbers are pointers into PRINCIPLES; a prompt should carry the reason
// itself rather than a reference the model cannot follow.
const CIRCLED = /[①-⑳]/g;

/** Fenced blocks under a Usage/Example heading that sit outside <example> tags. */
function unwrappedExampleFences(text) {
  const offenders = [];
  let heading = '';
  let depth = 0;
  let inFence = false;
  text.split('\n').forEach((line, index) => {
    if (!inFence && /^#{1,6}\s/.test(line)) heading = line.trim();
    if (!inFence) {
      depth += (line.match(/<examples?>/g) ?? []).length;
      depth -= (line.match(/<\/examples?>/g) ?? []).length;
    }
    if (/^\s*```/.test(line)) {
      if (!inFence && /usage|example/i.test(heading) && depth <= 0) offenders.push(`L${index + 1} under "${heading}"`);
      inFence = !inFence;
    }
  });
  return offenders;
}

describe('Prompt style (commands · agents · skills · output styles)', () => {
  it('enumeration covers the prompt surfaces — never silently empty', () => {
    assert.ok(targets.length >= 10, `only ${targets.length} prompt files enumerated`);
  });

  for (const file of targets) {
    const text = body(readRepoFile(file));
    const prose = stripCode(text);

    it(`${file} states rules without shouted imperatives`, () => {
      const hits = [...prose.matchAll(SHOUTED)].map((m) => m[0]);
      assert.deepEqual(hits, [], `shouted imperatives: ${hits.join(', ')} — say what to do and why instead`);
    });

    it(`${file} stays under the bold budget (${BOLD_MARKER_BUDGET} markers)`, () => {
      const count = (prose.match(/\*\*/g) ?? []).length;
      assert.ok(count <= BOLD_MARKER_BUDGET, `${count} bold markers — emphasis inflation`);
    });

    it(`${file} carries no callout glyphs`, () => {
      const hits = [...prose.matchAll(CALLOUTS)].map((m) => m[0]);
      assert.deepEqual(hits, [], `callout glyphs: ${hits.join(' ')}`);
    });

    it(`${file} cites no principle numbers — the reason belongs in the sentence`, () => {
      const hits = [...prose.matchAll(CIRCLED)].map((m) => m[0]);
      assert.deepEqual(hits, [], `principle pointers: ${hits.join(' ')}`);
    });

    it(`${file} wraps usage examples in <example> tags`, () => {
      const offenders = unwrappedExampleFences(text);
      assert.deepEqual(offenders, [], `fenced examples outside <example>:\n${offenders.join('\n')}`);
    });
  }
});

// Body budget — the per-invocation ratchet. A body is loaded whole each time its
// command, agent, or skill runs, so its size is context spent on every call.
// Each ceiling is the body's measured size (characters / 4, rounded) × 1.05,
// rounded up: the 5% headroom is room for the accepted 🟡 edits ultragoal
// applies after a goal completes, not for growth. An edit that needs a higher
// ceiling raises it in the same change and records the raise in the CHANGELOG.
const BODY_BUDGET_TOKENS = {
  'commands/deep-interview.md': 2153,
  'commands/fix.md': 1279,
  'commands/ralplan.md': 4628,
  'commands/review.md': 4250,
  'commands/setup.md': 3431,
  'commands/ship.md': 2106,
  'commands/spec.md': 231,
  'commands/sync.md': 2446,
  'commands/ultragoal.md': 5085,
  'commands/verify.md': 3312,
  'agents/critic.md': 3044,
  'agents/design-qa.md': 529,
  'agents/implementer.md': 1407,
  'skills/critic/SKILL.md': 1665,
  'skills/deep-interview/SKILL.md': 607,
  'skills/design-qa/SKILL.md': 387,
  'skills/fix/SKILL.md': 477,
  'skills/frontend-fundamentals/SKILL.md': 1437,
  'skills/implementer/SKILL.md': 806,
  'skills/ralplan/SKILL.md': 1686,
  'skills/review/SKILL.md': 1724,
  'skills/setup/SKILL.md': 815,
  'skills/ship/SKILL.md': 528,
  'skills/spec/SKILL.md': 131,
  'skills/sync/SKILL.md': 565,
  'skills/ultragoal/SKILL.md': 2342,
  'skills/verify/SKILL.md': 1196,
};

const bodyTargets = [
  ...listCommandFiles().map((f) => `commands/${f}`),
  ...listAgentFiles().map((f) => `agents/${f}`),
  ...listTrackedFiles('skills/*/SKILL.md'),
];

const bodyTokens = (source) => Math.round(body(source).length / 4);

function assertBodyBudget(file, source, budgets = BODY_BUDGET_TOKENS) {
  const ceiling = budgets[file];
  assert.ok(Number.isInteger(ceiling), `${file} has no BODY_BUDGET_TOKENS entry — add its measured size × 1.05`);
  const tokens = bodyTokens(source);
  assert.ok(tokens <= ceiling, `${file} body is ${tokens} estimated tokens, over its ${ceiling} ceiling — trim it, or raise the ceiling in this change and record it in the CHANGELOG`);
}

describe('Body budget (commands · agents · skills)', () => {
  it('enumeration covers every per-invocation body — never silently empty', () => {
    assert.ok(bodyTargets.length >= 20, `only ${bodyTargets.length} bodies enumerated`);
  });

  for (const file of bodyTargets) {
    it(`${file} body stays under its ceiling (${BODY_BUDGET_TOKENS[file] ?? 'missing'} tokens)`, () => {
      assertBodyBudget(file, readRepoFile(file));
    });
  }

  it('rejects an oversized body and a body without a ceiling', () => {
    const budgets = { 'fixture/commands/x.md': 100 };
    const fixture = (chars) => `---\ndescription: fixture\n---\n${'x'.repeat(chars)}`;
    assert.doesNotThrow(() => assertBodyBudget('fixture/commands/x.md', fixture(400), budgets));
    assert.throws(() => assertBodyBudget('fixture/commands/x.md', fixture(404), budgets), /over its 100 ceiling/);
    assert.throws(() => assertBodyBudget('fixture/commands/y.md', fixture(4), budgets), /has no BODY_BUDGET_TOKENS entry/);
  });
});
