/**
 * Prompt-style invariants — the official Anthropic prompting guide, pinned.
 *
 * Every command, agent, skill, and output-style body is a prompt Claude reads on
 * each invocation. The guide's advice (be clear and give the reason; say what to
 * do instead of shouting what not to do; separate examples from instructions
 * with <example> tags; avoid emphasis inflation that makes models overtrigger)
 * held for one release and then drifted back, so the mechanically checkable part
 * lives here. The rewrite that established these budgets is v0.8.0.
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
