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
 *   ⑤ per-run verdicts roll up into pass^k and pass@k consistency numbers
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function runRunner(sandbox, extraArgs, env = {}, { scaffold = false } = {}) {
  mkdirSync(sandbox.work, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--fallback', '--eval-dir', sandbox.evalDir, '--output-dir', sandbox.outDir, ...(scaffold ? [] : ['--no-scaffold']), '--json', path.join(sandbox.root, 'result.json'), ...extraArgs],
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

describe('eval-runner: run consistency', () => {
  it('reports pass^k and pass@k from per-run verdicts', () => {
    const sandbox = makeSandbox();
    const { status, aggregate } = runRunner(sandbox, ['--runs', '3', '--max-cost-usd', '10'], { FAKE_JUDGE_SEQUENCE: 'ok,fail,ok' });
    assert.ok(aggregate, 'aggregate is written');
    assert.deepEqual(aggregate.cases[0].arms.with.map((a) => a.passed), [true, false, true]);
    assert.equal(status, 0, 'the exit code still follows the mean');
    assert.equal(aggregate.cases[0].passed, true);
    assert.deepEqual(aggregate.cases[0].consistency, { runs: 3, passedRuns: 2, passAll: false, passAny: true });
    assert.equal(aggregate.aggregates.passAllRate, 0);
    assert.equal(aggregate.aggregates.passAnyRate, 1);
  });
});

describe('eval-runner: native case format', () => {
  it('rejects a prompt.md key the native format does not accept', () => {
    const sandbox = makeSandbox({ runs: 1 });
    writeFileSync(path.join(sandbox.evalDir, 'sample-case', 'prompt.md'), '---\nname: sample-case\nscaffold_script: cp -R x .\n---\n/oh-my-joy:spec "sample"\n');
    const { status, stderr } = runRunner(sandbox, ['--max-cost-usd', '10']);
    assert.notEqual(status, 0);
    assert.match(stderr, /unknown frontmatter key "scaffold_script"/);
  });

  it('passes a block-scalar system prompt with colons and dash lines through intact', () => {
    const sandbox = makeSandbox({ runs: 1 });
    writeFileSync(
      path.join(sandbox.evalDir, 'sample-case', 'prompt.md'),
      '---\nname: sample-case\nallowed_tools: [Read]\nappend_system_prompt: |\n  Rule one: keep colons.\n\n  - a dash line stays text\nruns: 1\n---\n/oh-my-joy:spec "sample"\n',
    );
    const { status } = runRunner(sandbox, ['--max-cost-usd', '10']);
    assert.equal(status, 0);
    const argv = JSON.parse(readFileSync(path.join(sandbox.stateDir, 'argv-1.json'), 'utf8'));
    assert.equal(argv[argv.indexOf('--append-system-prompt') + 1], 'Rule one: keep colons.\n\n- a dash line stays text');
  });

  it('runs the scaffold script named by case.yaml and refuses unsupported context keys', () => {
    const sandbox = makeSandbox({ runs: 1 });
    const caseDir = path.join(sandbox.evalDir, 'sample-case');
    writeFileSync(path.join(caseDir, 'scaffold.sh'), 'touch scaffolded.txt\n');
    writeFileSync(path.join(caseDir, 'case.yaml'), 'schema_version: "1.1"\nname: sample-case\ncontext:\n  scaffold_script: scaffold.sh\n');
    writeFileSync(path.join(caseDir, 'graders', 'scaffolded.md'), '---\ntype: file_exists\npath: scaffolded.txt\n---\n');
    const ok = runRunner(sandbox, ['--max-cost-usd', '10'], {}, { scaffold: true });
    assert.equal(ok.aggregate.cases[0].arms.with[0].graders.find((g) => g.name === 'scaffolded').score, 1);

    writeFileSync(path.join(caseDir, 'case.yaml'), 'schema_version: "1.1"\nname: sample-case\ncontext:\n  add_dirs: [resources]\n');
    const refused = runRunner(sandbox, ['--max-cost-usd', '10'], {}, { scaffold: true });
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /context\.add_dirs is unsupported by the fallback runner/);
  });

  it('reads tool_used min as 1 when only max is set, as the native runner does', () => {
    const sandbox = makeSandbox({ runs: 1 });
    writeFileSync(path.join(sandbox.evalDir, 'sample-case', 'graders', 'reads.md'), '---\ntype: tool_used\ntool: Read\nmax: 0\n---\n');
    const { aggregate } = runRunner(sandbox, ['--max-cost-usd', '10']);
    const grader = aggregate.cases[0].arms.with[0].graders.find((g) => g.name === 'reads');
    assert.match(grader.details, /min 1, max 0/);
    assert.equal(grader.score, 0);
  });
});

describe('eval-runner: fallback matches native tool and trace rules', () => {
  it('withholds tools the case does not allow and keeps personal configuration out', () => {
    const sandbox = makeSandbox({ runs: 1 });
    writeFileSync(path.join(sandbox.evalDir, 'sample-case', 'prompt.md'), '---\nname: sample-case\nallowed_tools: [Read, "Bash(git diff:*)", "Bash(git rev-parse:*)"]\n---\n/oh-my-joy:review\n');
    runRunner(sandbox, ['--max-cost-usd', '10']);
    const argv = JSON.parse(readFileSync(path.join(sandbox.stateDir, 'argv-1.json'), 'utf8'));
    const tools = argv.slice(argv.indexOf('--tools') + 1, argv.indexOf('--setting-sources'));
    assert.deepEqual(tools, ['Read', 'Bash']);
    assert.equal(argv[argv.indexOf('--setting-sources') + 1], 'project');
    assert.ok(argv.includes('--strict-mcp-config'));
    assert.deepEqual(argv.slice(argv.indexOf('--allowedTools') + 1, argv.indexOf('--allowedTools') + 4), ['Read', 'Bash(git diff:*)', 'Bash(git rev-parse:*)']);
  });

  it('shows a trace-focused judge the first and last 12 main-thread messages only', () => {
    const sandbox = makeSandbox({ runs: 1 });
    writeFileSync(path.join(sandbox.evalDir, 'sample-case', 'graders', 'quality.md'), '---\ntype: llm\nfocus: trace\n---\nThe session read a file.\n');
    writeFileSync(path.join(sandbox.evalDir, 'sample-case', 'graders', 'no-subagent.md'), '---\ntype: regex\npattern: "subagent-only"\nmatch: not_contains\ntarget: trace\n---\n');
    const { aggregate } = runRunner(sandbox, ['--max-cost-usd', '10'], { FAKE_RUN_EVENTS: '25', FAKE_JUDGE_ECHO: '1' });
    const judged = readFileSync(path.join(sandbox.stateDir, 'judge-1.txt'), 'utf8');
    assert.match(judged, /message-01/);
    assert.match(judged, /message-11/);
    for (const outside of ['message-12', 'message-13', 'message-14']) assert.doesNotMatch(judged, new RegExp(`${outside}\\b`), `${outside} is outside the 12 + 12 window`);
    assert.match(judged, /message-11[\s\S]*…[\s\S]*message-15/, 'the window keeps message-11, marks the gap, then resumes at message-15');
    assert.match(judged, /message-25/);
    assert.doesNotMatch(judged, /subagent-only/);
    assert.equal(aggregate.cases[0].arms.with[0].graders.find((g) => g.name === 'no-subagent').score, 1);
  });

  it('writes one JSON line per tool call so trace patterns can stay on one line', () => {
    const sandbox = makeSandbox({ runs: 1 });
    writeFileSync(path.join(sandbox.evalDir, 'sample-case', 'graders', 'tool-line.md'), '---\ntype: regex\npattern: "^\\\\{\\"tool\\":\\"Read\\",\\"input\\":\\\\{\\"file_path\\":\\"src/server\\\\.mjs\\"\\\\}\\\\}$"\nflags: m\ntarget: trace\n---\n');
    const { aggregate } = runRunner(sandbox, ['--max-cost-usd', '10']);
    assert.equal(aggregate.cases[0].arms.with[0].graders.find((g) => g.name === 'tool-line').score, 1);
  });

  it('passes an empty --tools list when a case allows no tools', () => {
    const sandbox = makeSandbox({ runs: 1 });
    writeFileSync(path.join(sandbox.evalDir, 'sample-case', 'prompt.md'), '---\nname: sample-case\n---\n/oh-my-joy:spec "sample"\n');
    runRunner(sandbox, ['--max-cost-usd', '10']);
    const argv = JSON.parse(readFileSync(path.join(sandbox.stateDir, 'argv-1.json'), 'utf8'));
    assert.deepEqual(argv.slice(argv.indexOf('--tools'), argv.indexOf('--tools') + 3), ['--tools', '', '--setting-sources']);
    assert.ok(!argv.includes('--allowedTools'));
  });
});

describe('eval-runner: native delegation', () => {
  function runNativeRunner(sandbox, extraArgs = [], env = {}) {
    mkdirSync(sandbox.work, { recursive: true });
    const result = spawnSync(process.execPath, [SCRIPT, '--eval-dir', sandbox.evalDir, '--output-dir', sandbox.outDir, ...extraArgs], {
      encoding: 'utf8',
      env: { ...process.env, OMJ_EVAL_CLAUDE_BIN: sandbox.wrapper, OMJ_EVAL_TMPDIR: sandbox.work, FAKE_STATE_DIR: sandbox.stateDir, FAKE_NATIVE: '1', ...env },
    });
    const runs = {};
    if (existsSync(sandbox.stateDir)) {
      for (const file of readdirSync(sandbox.stateDir).filter((f) => /^native-.+\.json$/.test(f))) {
        const record = JSON.parse(readFileSync(path.join(sandbox.stateDir, file), 'utf8'));
        runs[file.slice('native-'.length, -'.json'.length)] = record;
      }
    }
    const summaryPath = path.join(sandbox.outDir, 'summary.json');
    return { status: result.status, stderr: result.stderr, runs, summary: existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, 'utf8')) : null };
  }

  function addCase(sandbox, name, frontmatter) {
    mkdirSync(path.join(sandbox.evalDir, name, 'graders'), { recursive: true });
    writeFileSync(path.join(sandbox.evalDir, name, 'prompt.md'), `---\nname: ${name}\n${frontmatter}\n---\n/oh-my-joy:review\n`);
  }

  const valuesAfter = (argv, flag) => {
    const start = argv.indexOf(flag);
    if (start === -1) return [];
    const rest = argv.slice(start + 1);
    const stop = rest.findIndex((a) => a.startsWith('-'));
    return stop === -1 ? rest : rest.slice(0, stop);
  };

  const overlapping = (a, b) => a.startedAt < b.endedAt && b.startedAt < a.endedAt;
  const maxSimultaneous = (records) => {
    const events = records.flatMap((r) => [[r.startedAt, 1], [r.endedAt, -1]]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    let now = 0;
    let peak = 0;
    for (const [, delta] of events) peak = Math.max(peak, (now += delta));
    return peak;
  };

  it('runs each case as its own trusted, unpublished native run with that case\'s gated tools, and exits 0', () => {
    const sandbox = makeSandbox({ runs: 1 });
    addCase(sandbox, 'git-case', 'allowed_tools: [Read, Skill, "Bash(git diff:*)"]');
    addCase(sandbox, 'ship-case', 'allowed_tools: [Read, "Bash(git commit:*)", AskUserQuestion]');
    const { status, runs, summary } = runNativeRunner(sandbox, ['--runs', '1']);
    assert.equal(status, 0, 'the async entry returns the run status');
    assert.deepEqual(Object.keys(runs).sort(), ['git-case', 'sample-case', 'ship-case']);
    assert.deepEqual(valuesAfter(runs['git-case'].argv, '--allow-tools'), ['Bash(git diff:*)']);
    assert.deepEqual(valuesAfter(runs['sample-case'].argv, '--allow-tools'), []);
    assert.deepEqual(valuesAfter(runs['ship-case'].argv, '--allow-tools'), ['Bash(git commit:*)', 'AskUserQuestion']);
    for (const { argv } of Object.values(runs)) {
      for (const flag of ['--trust-plugin', '--no-publish', '--scaffold']) assert.ok(argv.includes(flag), `${flag} is passed`);
      assert.equal(argv[argv.indexOf('--ablation') + 1], 'none');
      assert.ok(!argv.includes('-j'), 'a single run needs no run concurrency');
    }
    assert.deepEqual(summary.cases.map((c) => c.name), ['git-case', 'sample-case', 'ship-case'], 'the summary keeps case order');
    for (const key of ['startedAt', 'finishedAt', 'wallSeconds', 'jobs']) assert.ok(key in summary, `summary.${key}`);
  });

  it('overlaps runs up to --jobs and runs them one at a time with --jobs 1', () => {
    const parallel = makeSandbox({ runs: 1 });
    for (const name of ['a-case', 'b-case', 'c-case']) addCase(parallel, name, 'allowed_tools: [Read]');
    const fast = runNativeRunner(parallel, ['--jobs', '4', '--runs', '1'], { FAKE_NATIVE_DELAY_MS: '400' });
    assert.equal(fast.status, 0);
    const records = Object.values(fast.runs);
    assert.equal(records.length, 4);
    assert.ok(records.some((a) => records.some((b) => a !== b && overlapping(a, b))), 'some runs overlap');

    const serial = makeSandbox({ runs: 1 });
    for (const name of ['a-case', 'b-case']) addCase(serial, name, 'allowed_tools: [Read]');
    const slow = runNativeRunner(serial, ['--jobs', '1', '--runs', '1'], { FAKE_NATIVE_DELAY_MS: '150' });
    const serialRecords = Object.values(slow.runs);
    assert.ok(serialRecords.every((a) => serialRecords.every((b) => a === b || !overlapping(a, b))), 'no runs overlap');
  });

  it('reserves each case\'s estimate before starting it, waits for spend to settle, and exits 2 on what cannot fit', () => {
    const sandbox = makeSandbox({ runs: 1 });
    for (const name of ['a-case', 'b-case', 'c-case']) addCase(sandbox, name, 'allowed_tools: [Read]');
    // Estimate 1 per case, actual 0.9, $2.9 cap: two runs start at once, the
    // third starts once one settles (0.9 + 1 + 1 = 2.9), and the fourth never fits.
    const { status, stderr, runs, summary } = runNativeRunner(sandbox, ['--jobs', '4', '--runs', '1', '--max-cost-usd', '2.9', '--run-cost-estimate', '1'], { FAKE_NATIVE_COST: '0.9', FAKE_NATIVE_DELAY_MS: '300' });
    assert.equal(status, 2);
    const records = Object.values(runs);
    assert.equal(records.length, 3, 'three runs fit the budget in turn');
    assert.ok(maxSimultaneous(records) <= 2, 'never more runs at once than the budget allows');
    assert.match(stderr, /cannot cover .* — not started/);
    assert.equal(summary.cases.filter((c) => c.notStarted).length, 1, 'the case that never started is in the summary');
    const ceilings = records.map((r) => Number(r.argv[r.argv.indexOf('--max-cost-usd') + 1])).sort((a, b) => b - a);
    assert.equal(ceilings[0], 2.9, 'the first runs get the budget left after other reservations and spend');
  });

  it('reserves runs × arms of the per-run estimate', () => {
    const sandbox = makeSandbox({ runs: 3 });
    // 3 runs × 2 arms × $1 = $6 per case: a $5 cap starts nothing.
    const { status, runs, stderr } = runNativeRunner(sandbox, ['--ablation', 'with-without', '--max-cost-usd', '5', '--run-cost-estimate', '1']);
    assert.equal(status, 2);
    assert.deepEqual(Object.keys(runs), []);
    assert.match(stderr, /estimate \$6\.00/);
  });

  it('passes -j for multi-run cases, honours --no-scaffold and --ablation, and leaves fallback-only cases out', () => {
    const sandbox = makeSandbox({ runs: 3 });
    addCase(sandbox, 'needs-no-agent', 'tags: [review, fallback-only]\nallowed_tools: [Read]');
    const { status, stderr, runs } = runNativeRunner(sandbox, ['--no-scaffold', '--ablation', 'with-without']);
    assert.equal(status, 0);
    assert.deepEqual(Object.keys(runs), ['sample-case']);
    const { argv } = runs['sample-case'];
    assert.ok(!argv.includes('--scaffold'));
    assert.equal(argv[argv.indexOf('--ablation') + 1], 'with-without');
    assert.equal(argv[argv.indexOf('-j') + 1], '3');
    assert.match(stderr, /needs-no-agent is fallback-only/);
  });

  it('falls back when the native probe gives no positive signal', () => {
    const sandbox = makeSandbox({ runs: 1 });
    mkdirSync(sandbox.work, { recursive: true });
    const wrapper = path.join(sandbox.root, 'old-claude');
    writeFileSync(wrapper, `#!/bin/sh\nif [ "$1" = plugin ]; then echo "error: unknown command 'plugin'" >&2; exit 1; fi\nexec "${process.execPath}" "${STUB}" "$@"\n`);
    chmodSync(wrapper, 0o755);
    const result = spawnSync(process.execPath, [SCRIPT, '--eval-dir', sandbox.evalDir, '--output-dir', sandbox.outDir, '--no-scaffold', '--max-cost-usd', '10'], {
      encoding: 'utf8',
      env: { ...process.env, OMJ_EVAL_CLAUDE_BIN: wrapper, OMJ_EVAL_TMPDIR: sandbox.work, FAKE_STATE_DIR: sandbox.stateDir },
    });
    assert.match(result.stderr, /running the fallback runner/);
  });
});
