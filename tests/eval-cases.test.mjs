/**
 * Eval case files follow the native `claude plugin eval` format, so the native
 * runner and the fallback runner load the same suite. An unknown key is a load
 * error natively; these checks catch it before a paid run does.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { repoPath } from './helpers/repo.mjs';

const EVALS = repoPath('evals');
const PROMPT_KEYS = ['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'model', 'max_turns', 'timeout_seconds', 'allowed_tools', 'append_system_prompt', 'env'];
const GRADER_KEYS = ['type', 'weight', 'arm', 'pattern', 'flags', 'match', 'target', 'tool', 'input_match', 'min', 'max', 'before', 'after', 'path', 'exists', 'criteria', 'focus', 'baseline_file'];
const TARGETS = ['last_message', 'trace', 'files', 'mock_calls'];
// Values the native loader was observed to accept for an llm focus; a free-text focus fails to load.
const FOCUS = ['last_message', 'trace'];
// Tools a native run withholds unless granted, so a never-called grader on them only means something when the case lists the tool.
const GATED = ['Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch'];

const cases = readdirSync(EVALS)
  .filter((entry) => existsSync(path.join(EVALS, entry, 'prompt.md')))
  .sort();

function frontmatter(file) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(readFileSync(file, 'utf8'));
  assert.ok(match, `${file}: frontmatter`);
  const keys = [...match[1].matchAll(/^([A-Za-z0-9_-]+):\s*(.*)$/gm)].map((m) => ({ key: m[1], value: m[2].trim() }));
  return { keys, body: match[2].trim() };
}

function toolNames(value) {
  return new Set((value.match(/\[(.*)\]/)?.[1] ?? '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.trim().replace(/^"|"$/g, '').replace(/\(.*$/, '')).filter(Boolean));
}

describe('eval cases use the native case format', () => {
  it('finds the suite', () => {
    assert.ok(cases.length >= 32, `expected the eval suite, found ${cases.length} cases`);
  });

  for (const name of cases) {
    const dir = path.join(EVALS, name);
    const { keys, body } = frontmatter(path.join(dir, 'prompt.md'));
    const allowed = toolNames(keys.find((k) => k.key === 'allowed_tools')?.value ?? '[]');
    const tags = toolNames(keys.find((k) => k.key === 'tags')?.value ?? '[]');

    if (tags.has('ablation')) {
      it(`${name}: an ablation case sends a plain request, not a command`, () => {
        // The without-plugin arm has no OMJ command, so a slash prompt there measures nothing.
        assert.doesNotMatch(body, /^\//);
      });
    }

    it(`${name}: prompt.md uses only native frontmatter keys`, () => {
      for (const { key } of keys) assert.ok(PROMPT_KEYS.includes(key), `unknown key "${key}"`);
    });

    it(`${name}: case.yaml names an existing scaffold script`, () => {
      const casePath = path.join(dir, 'case.yaml');
      assert.ok(existsSync(casePath), 'every case seeds its workspace through case.yaml');
      const source = readFileSync(casePath, 'utf8');
      assert.match(source, /^schema_version: "1\.1"$/m);
      assert.match(source, new RegExp(`^name: ${name}$`, 'm'));
      const script = /^ {2}scaffold_script: (.+)$/m.exec(source)?.[1];
      assert.ok(script && existsSync(path.join(dir, script)), `scaffold script ${script} exists`);
    });

    for (const file of readdirSync(path.join(dir, 'graders')).filter((f) => f.endsWith('.md'))) {
      it(`${name}/${file}: grader follows the native schema`, () => {
        const { keys: gkeys, body } = frontmatter(path.join(dir, 'graders', file));
        const get = (k) => gkeys.find((g) => g.key === k)?.value;
        for (const { key } of gkeys) assert.ok(GRADER_KEYS.includes(key), `unknown grader key "${key}"`);
        if (get('target')) assert.ok(TARGETS.includes(get('target')), `target "${get('target')}" is not a native value`);
        if (get('focus')) assert.ok(FOCUS.includes(get('focus')), `focus "${get('focus')}" is not a native value`);
        if (get('type') === 'llm') {
          assert.ok(body, 'an llm grader keeps its rubric in the body');
          assert.equal(get('criteria'), undefined, 'the body is the rubric, so no criteria key competes with it');
        }
        if (get('type') === 'tool_used' && get('max') === '0') {
          assert.equal(get('min'), '0', 'min defaults to 1 natively, so a never-called grader sets min: 0');
          if (GATED.includes(get('tool'))) assert.ok(allowed.has(get('tool')), `a never-called grader on ${get('tool')} is vacuous unless the case allows that tool`);
        }
      });
    }
  }

  it('trace patterns match only inside a tool command, however the command is quoted', () => {
    const pattern = (file) => {
      const raw = /^pattern: "(.*)"$/m.exec(readFileSync(path.join(EVALS, file), 'utf8'))[1];
      return new RegExp(raw.replace(/\\(["\\])/g, '$1'));
    };
    const line = (command, description) => JSON.stringify({ tool: 'Bash', input: { command, description } });
    const korean = pattern('ship-on-shared-branch/graders/korean-commit.md');
    assert.ok(korean.test(line("git add src/server.mjs && git commit -F - <<'EOF'\n기능: 배포 표시 추가\nEOF", 'commit')));
    assert.ok(!korean.test(line('git commit -m "feat: add shipped flag"', '변경 사항 커밋')), 'a Korean description does not rescue an English message');
    const ledger = pattern('ultragoal-requires-plan/graders/no-state-init.md');
    assert.ok(ledger.test(line('node "/plugin/scripts/goal-state.mjs" init --slug x', 'init')));
    assert.ok(ledger.test(line('node scripts/goal-state.mjs init --slug x', 'init')));
    assert.ok(!ledger.test(JSON.stringify({ text: 'I will not run goal-state.mjs init before approval' })));
  });

  it('every scaffold script seeds a workspace from the fixtures', () => {
    for (const name of cases) {
      const script = path.join(EVALS, name, 'scaffold.sh');
      const workspace = mkdtempSync(path.join(tmpdir(), `omj-scaffold-${name}-`));
      try {
        const result = spawnSync('bash', [script], { cwd: workspace, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
        assert.equal(result.status, 0, `${name}: scaffold exits 0 — ${result.stderr}`);
        assert.ok(existsSync(path.join(workspace, 'package.json')), `${name}: the fixture landed in the workspace`);
      } finally {
        rmSync(workspace, { recursive: true, force: true });
      }
    }
  });

  it('style-korean-answer inlines the answer style verbatim', () => {
    const prompt = readFileSync(path.join(EVALS, 'style-korean-answer', 'prompt.md'), 'utf8');
    const inline = /^append_system_prompt: \|\n([\s\S]*?)\n---$/m.exec(prompt)?.[1] ?? '';
    const unindented = inline.split('\n').map((l) => l.replace(/^ {2}/, '')).join('\n').trim();
    const style = readFileSync(repoPath('output-styles', 'oh-my-joy.md'), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '').trim();
    assert.equal(unindented, style, 'the inline system prompt matches output-styles/oh-my-joy.md');
  });
});
