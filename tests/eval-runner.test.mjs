/**
 * Behavioral proof for scripts/eval-runner.mjs — verified through a real child
 * process against a stub `claude` (tests/helpers/fake-claude.mjs), never by
 * importing functions.
 *
 * The runner's contract:
 *   ① every run's final message and grader results are saved next to the aggregate
 *   ② the cost ceiling is checked before a run starts, using an estimate, and a
 *      run that did start is always graded — including its llm graders
 *   ③ a budget below one run's estimate starts nothing and says so
 *   ④ an unparseable judge reply is retried once; a second failure scores null
 *      and is counted, instead of silently scoring zero
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { repoPath } from './helpers/repo.mjs';

const SCRIPT = repoPath('scripts', 'eval-runner.mjs');
const STUB = repoPath('tests', 'helpers', 'fake-claude.mjs');

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function makeSandbox({ runs = 3 } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'omj-eval-runner-test-'));
  roots.push(root);
  const caseDir = path.join(root, 'evals', 'sample-case', 'graders');
  mkdirSync(caseDir, { recursive: true });
  mkdirSync(path.join(root, 'evals', 'fixtures'), { recursive: true });
  writeFileSync(
    path.join(root, 'evals', 'sample-case', 'prompt.md'),
    `---\nname: sample-case\nruns: ${runs}\nmax_turns: 4\nallowed_tools: [Read]\n---\n/oh-my-joy:spec "sample"\n`,
  );
  writeFileSync(path.join(caseDir, 'ready.md'), '---\ntype: regex\npattern: "Critique: ready"\nmatch: contains\ntarget: last_message\n---\n');
  writeFileSync(path.join(caseDir, 'reads.md'), '---\ntype: tool_used\ntool: Read\nmin: 1\n---\n');
  writeFileSync(path.join(caseDir, 'quality.md'), '---\ntype: llm\ncriteria: The answer carries a critique section.\n---\n');
  // A shell wrapper so the runner can spawn the stub like a binary; the exec bit
  // is set here at run time rather than relied on from git.
  const wrapper = path.join(root, 'claude');
  writeFileSync(wrapper, `#!/bin/sh\nexec "${process.execPath}" "${STUB}" "$@"\n`);
  chmodSync(wrapper, 0o755);
  return { root, wrapper, evalDir: path.join(root, 'evals'), outDir: path.join(root, 'out'), stateDir: path.join(root, 'state'), work: path.join(root, 'work') };
}

function runRunner(sandbox, extraArgs, env = {}) {
  mkdirSync(sandbox.work, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--fallback', '--eval-dir', sandbox.evalDir, '--output-dir', sandbox.outDir, '--no-scaffold', '--json', path.join(sandbox.root, 'result.json'), ...extraArgs],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        OMJ_EVAL_CLAUDE_BIN: sandbox.wrapper,
        OMJ_EVAL_TMPDIR: sandbox.work,
        FAKE_STATE_DIR: sandbox.stateDir,
        FAKE_RUN_COST: '1.8',
        ...env,
      },
    },
  );
  const jsonPath = path.join(sandbox.root, 'result.json');
  const aggregate = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : null;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, aggregate };
}

describe('eval-runner: run outputs are saved', () => {
  it('writes run-N.md and run-N.json per run and links them from the aggregate', () => {
    const sandbox = makeSandbox();
    const { status, aggregate } = runRunner(sandbox, ['--runs', '1', '--max-cost-usd', '10'], { FAKE_RUN_TEXT: '## Critique\n\nCritique: ready\n' });
    assert.equal(status, 0);
    const md = path.join(sandbox.outDir, 'sample-case', 'run-1.md');
    const json = path.join(sandbox.outDir, 'sample-case', 'run-1.json');
    assert.ok(existsSync(md), 'run-1.md is written');
    assert.match(readFileSync(md, 'utf8'), /Critique: ready/);
    const record = JSON.parse(readFileSync(json, 'utf8'));
    assert.equal(record.cost, 1.8);
    assert.deepEqual(record.graders.map((g) => g.name).sort(), ['quality', 'reads', 'ready']);
    assert.equal(record.toolCalls[0].name, 'Read');
    const arm = aggregate.cases[0].arms.with[0];
    assert.ok(arm.outputPath.endsWith(path.join('sample-case', 'run-1.md')), `outputPath links the run: ${arm.outputPath}`);
    assert.ok(existsSync(path.join(sandbox.outDir, 'aggregate-result.json')));
  });
});

describe('eval-runner: cost ceiling', () => {
  it('checks the ceiling before a run starts and still grades the run it did start', () => {
    // Estimate 2 for the first run, then the observed 1.8: run 1 fits in $3,
    // run 2 would land at 3.6 and is not started.
    const sandbox = makeSandbox({ runs: 3 });
    const { status, aggregate } = runRunner(sandbox, ['--max-cost-usd', '3']);
    assert.equal(status, 2, 'the ceiling exit code');
    assert.equal(aggregate.aggregates.ceilingHit, true);
    const arms = aggregate.cases[0].arms.with;
    assert.equal(arms.length, 1, 'exactly one run started');
    const llm = arms[0].graders.find((g) => g.type === 'llm');
    assert.equal(llm.score, 1, 'the llm grader ran on the run that was paid for');
    assert.ok(aggregate.aggregates.costUsd > 1.8, 'judge cost is added to the spend');
  });

  it('starts nothing when the budget is below one run\'s estimate, and says so', () => {
    const sandbox = makeSandbox();
    const { status, stderr, aggregate } = runRunner(sandbox, ['--max-cost-usd', '1']);
    assert.equal(status, 2);
    assert.equal(aggregate.cases[0].arms.with.length, 0);
    assert.match(stderr, /below one run's estimate/);
  });

  it('honours --run-cost-estimate for the first run', () => {
    const sandbox = makeSandbox({ runs: 1 });
    const { status, aggregate } = runRunner(sandbox, ['--max-cost-usd', '1', '--run-cost-estimate', '0.5']);
    assert.equal(status, 0);
    assert.equal(aggregate.cases[0].arms.with.length, 1);
  });
});

describe('eval-runner: judge robustness', () => {
  it('retries an unparseable judge reply once and counts the retry', () => {
    const sandbox = makeSandbox({ runs: 1 });
    const { status, aggregate } = runRunner(sandbox, ['--max-cost-usd', '10'], { FAKE_JUDGE_SEQUENCE: 'garbage,ok' });
    assert.equal(status, 0);
    const llm = aggregate.cases[0].arms.with[0].graders.find((g) => g.type === 'llm');
    assert.equal(llm.score, 1);
    assert.equal(aggregate.aggregates.judgeRetries, 1);
    assert.equal(aggregate.aggregates.judgeFailures, 0);
  });

  it('scores null and counts a failure when both judge attempts are unparseable', () => {
    const sandbox = makeSandbox({ runs: 1 });
    const { status, aggregate } = runRunner(sandbox, ['--max-cost-usd', '10'], { FAKE_JUDGE_SEQUENCE: 'garbage,garbage' });
    assert.equal(status, 0, 'the other graders still carry the case');
    const llm = aggregate.cases[0].arms.with[0].graders.find((g) => g.type === 'llm');
    assert.equal(llm.score, null);
    assert.match(llm.details, /2 attempts/);
    assert.equal(aggregate.aggregates.judgeFailures, 1);
    assert.equal(aggregate.cases[0].score, 1, 'a null grader is excluded from the mean, not counted as zero');
  });
});
