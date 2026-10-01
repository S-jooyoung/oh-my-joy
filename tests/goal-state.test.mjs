import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';

import { repoPath } from './helpers/repo.mjs';

const SCRIPT = repoPath('scripts', 'goal-state.mjs');
const V2_SCRIPT = repoPath('tests', 'fixtures', 'goal-state-v2.mjs');
const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function makeRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'omj-goals-'));
  roots.push(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'OMJ Test');
  writeFileSync(path.join(root, 'app.txt'), 'base\n');
  git(root, 'add', 'app.txt');
  git(root, 'commit', '-qm', 'base');
  return root;
}

function run(root, verb, input, slug = 'demo', script = SCRIPT) {
  const result = spawnSync('node', [script, verb, '--slug', slug], {
    cwd: root,
    input: input === undefined ? '' : JSON.stringify(input),
    encoding: 'utf8',
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: result.status === 0 && result.stdout.trim() ? JSON.parse(result.stdout) : null,
  };
}

const goals = (second = true) => [
  { id: 'G1', title: 'Change one', objective: 'Make the first change', kind: 'change', acceptance: ['first behavior works'] },
  ...(second ? [{ id: 'G2', title: 'Change two', objective: 'Make the second change', kind: 'change', acceptance: ['second behavior works'] }] : []),
];

function init(root, options = {}) {
  return run(root, 'init', { brief: '# Approved plan\n', goals: options.goals ?? goals(options.second), pr: options.pr });
}

function passGoal(root, revision, goalId, argv = ['node', '-e', 'console.log("verified")']) {
  let result = run(root, 'start', { expectedRevision: revision, goalId });
  assert.equal(result.code, 0, result.stderr);
  result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId }, argv });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.json.exitCode, 0);
  result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId }, reviewer: 'independent-reviewer', verdict: 'pass', summary: 'No blocking findings.' });
  assert.equal(result.code, 0, result.stderr);
  const criterion = goalId === 'G1' ? 'first behavior works' : 'second behavior works';
  result = run(root, 'complete', { expectedRevision: result.json.revision, goalId, acceptanceEvidence: [{ criterion, evidence: `${goalId} observed in ${result.json.artifact}` }] });
  assert.equal(result.code, 0, result.stderr);
  return result.json.revision;
}

function finalProof(root, revision) {
  let result = run(root, 'verify', { expectedRevision: revision, scope: 'final', argv: ['node', '-e', 'console.log("final verified")'] });
  assert.equal(result.code, 0, result.stderr);
  result = run(root, 'review', { expectedRevision: result.json.revision, scope: 'final', reviewer: 'final-reviewer', verdict: 'pass', summary: 'Final diff passes review.' });
  assert.equal(result.code, 0, result.stderr);
  return result.json.revision;
}

describe('goal-state durable lifecycle', () => {
  it('resumes in a new process and closes only after fresh final proof', () => {
    const root = makeRepo();
    const created = init(root);
    assert.equal(created.code, 0, created.stderr);
    const snapshotPath = path.join(root, '.omj/goals/demo/goals.json');
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    assert.equal(snapshot.schemaVersion, 3);
    assert.match(snapshot.planHash, /^[0-9a-f]{64}$/);
    assert.equal(snapshot.identity.worktreeRoot, git(root, 'rev-parse', '--show-toplevel'));

    let revision = passGoal(root, created.json.revision, 'G1');
    writeFileSync(path.join(root, 'app.txt'), 'after first goal\n');
    revision = passGoal(root, revision, 'G2');
    revision = finalProof(root, revision);
    const closed = run(root, 'close', { expectedRevision: revision });
    assert.equal(closed.code, 0, closed.stderr);

    const resumed = run(root, 'status');
    assert.equal(resumed.code, 0, resumed.stderr);
    assert.equal(resumed.json.closed, true);
    assert.deepEqual(resumed.json.goals.map((goal) => goal.status), ['complete', 'complete']);
    assert.ok(existsSync(path.join(root, '.omj/goals/demo/brief.md')));
    assert.ok(existsSync(path.join(root, '.omj/goals/demo/evidence')));
  });

  it('supports explicit report evidence without inventing a test command', () => {
    const root = makeRepo();
    const reportGoals = [{ id: 'R1', title: 'Audit', objective: 'Report findings', kind: 'report', acceptance: ['sources are named'] }];
    let result = init(root, { goals: reportGoals });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'R1' });
    result = run(root, 'evidence', { expectedRevision: result.json.revision, scope: { goalId: 'R1' }, summary: 'Inspected the source files.', acceptance: ['Named app.txt as the source.'] });
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'R1' }, reviewer: 'reviewer', verdict: 'pass', summary: 'Report is supported.' });
    result = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'R1', acceptanceEvidence: [{ criterion: 'sources are named', evidence: 'app.txt is cited by the report artifact' }] });
    assert.equal(result.code, 0, result.stderr);
  });

  it('enforces one active goal and supports blocked-to-active resume', () => {
    const root = makeRepo();
    let result = init(root);
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    const second = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G2' });
    assert.equal(second.code, 1);
    assert.match(second.stderr, /single active goal/);
    result = run(root, 'block', { expectedRevision: result.json.revision, goalId: 'G1', reason: 'External input unavailable' });
    assert.equal(run(root, 'status').json.goals[0].status, 'blocked');
    result = run(root, 'resume', { expectedRevision: result.json.revision, goalId: 'G1' });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(run(root, 'status').json.goals[0].status, 'active');
  });

  it('detects changes to the immutable approved brief', () => {
    const root = makeRepo();
    init(root, { second: false });
    writeFileSync(path.join(root, '.omj/goals/demo/brief.md'), '# Replaced plan\n');
    const result = run(root, 'status');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /approved plan hash mismatch/);
  });

  it('fingerprints relevant .omj config and hashes an untracked symlink without following it', () => {
    const root = makeRepo();
    symlinkSync('/path/that/does/not/exist', path.join(root, 'broken-link'));
    const result = init(root, { second: false });
    assert.equal(result.code, 0, result.stderr);
    mkdirSync(path.join(root, '.omj'), { recursive: true });
    writeFileSync(path.join(root, '.omj/fe-context.md'), 'verifyCommands: changed\n');
    const started = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    const status = run(root, 'status');
    assert.equal(status.code, 0, status.stderr);
    assert.notEqual(status.json.initialFingerprint.sha256, run(root, 'verify', {
      expectedRevision: started.json.revision,
      scope: { goalId: 'G1' },
      argv: ['node', '-e', 'process.exit(0)'],
    }).json.fingerprint);
  });

  it('runs through a symlinked scripts directory exactly as through the real path', { skip: process.platform === 'win32' }, () => {
    const linkDir = mkdtempSync(path.join(tmpdir(), 'omj-linked-'));
    roots.push(linkDir);
    symlinkSync(repoPath('scripts'), path.join(linkDir, 'linked'));
    const linked = path.join(linkDir, 'linked', 'goal-state.mjs');
    const root = makeRepo();
    const real = run(root, 'status', undefined, 'Bad!');
    const viaLink = run(root, 'status', undefined, 'Bad!', linked);
    assert.equal(real.code, 1);
    assert.equal(viaLink.code, 1);
    assert.match(viaLink.stderr, /--slug allows/);
    assert.equal(viaLink.stderr, real.stderr);
    let result = run(root, 'init', { brief: '# Approved plan\n', goals: goals(false) }, 'demo', linked);
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'status', undefined, 'demo', linked);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.json.revision, 1);
    result = run(root, 'start', { expectedRevision: 1, goalId: 'G1' }, 'demo', linked);
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'console.log("ran")'] }, 'demo', linked);
    assert.equal(result.json?.exitCode, 0, result.stderr);
    assert.equal(result.json.excerpt.stdout, 'ran');
  });
});

describe('goal-state concurrency and recovery', () => {
  it('rejects stale revisions and a concurrent writer lock', async () => {
    const root = makeRepo();
    const created = init(root, { second: false });
    const stale = run(root, 'start', { expectedRevision: 0, goalId: 'G1' });
    assert.equal(stale.code, 1);
    assert.match(stale.stderr, /revision conflict/);

    let started = run(root, 'start', { expectedRevision: created.json.revision, goalId: 'G1' });
    const child = spawn('node', [SCRIPT, 'verify', '--slug', 'demo'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.end(JSON.stringify({ expectedRevision: started.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'setTimeout(() => {}, 600)'] }));
    const lock = path.join(root, '.omj/goals/demo.lock');
    const deadline = Date.now() + 2000;
    while (!existsSync(lock) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(existsSync(lock), 'verification process did not acquire the writer lock');
    const blocked = run(root, 'block', { expectedRevision: started.json.revision, goalId: 'G1', reason: 'wait' });
    assert.equal(blocked.code, 1);
    assert.match(blocked.stderr, /writer lock/);
    const exitCode = await new Promise((resolve) => child.on('close', resolve));
    assert.equal(exitCode, 0);
  });

  it('rejects corrupt/truncated ledgers and rebuilds a missing snapshot from the ledger', () => {
    const root = makeRepo();
    const created = init(root, { second: false });
    const snapshot = path.join(root, '.omj/goals/demo/goals.json');
    unlinkSync(snapshot);
    const recoverable = run(root, 'status');
    assert.equal(recoverable.code, 0, recoverable.stderr);
    assert.equal(recoverable.json.snapshotStatus, 'missing');
    const reconciled = run(root, 'reconcile', { expectedRevision: recoverable.json.revision });
    assert.equal(reconciled.code, 0, reconciled.stderr);
    assert.ok(existsSync(snapshot));

    const ledger = path.join(root, '.omj/goals/demo/ledger.jsonl');
    writeFileSync(ledger, readFileSync(ledger, 'utf8').trimEnd());
    const truncated = run(root, 'status');
    assert.equal(truncated.code, 1);
    assert.match(truncated.stderr, /truncated/);

    writeFileSync(ledger, '{not json}\n');
    const corrupt = run(root, 'status');
    assert.equal(corrupt.code, 1);
    assert.match(corrupt.stderr, /corrupt JSON/);
  });

  it('recovers only a demonstrably dead same-host writer lock', () => {
    const root = makeRepo();
    const created = init(root, { second: false });
    const lock = path.join(root, '.omj/goals/demo.lock');
    mkdirSync(lock);
    writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: 2_000_000_000, host: hostname(), token: 'dead' }));
    const started = run(root, 'start', { expectedRevision: created.json.revision, goalId: 'G1' });
    assert.equal(started.code, 0, started.stderr);
    assert.equal(existsSync(lock), false);
  });

  it('allows only one writer when two processes contend for a stale lock', async () => {
    const root = makeRepo();
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    const lock = path.join(root, '.omj/goals/demo.lock');
    mkdirSync(lock);
    writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: 2_000_000_000, host: hostname(), token: 'dead-race' }));
    const payload = JSON.stringify({ expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'setTimeout(() => {}, 500)'] });
    const launch = () => new Promise((resolve) => {
      const child = spawn('node', [SCRIPT, 'verify', '--slug', 'demo'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdin.end(payload);
      child.on('close', (code) => resolve(code));
    });
    const codes = await Promise.all([launch(), launch()]);
    assert.deepEqual(codes.sort(), [0, 1]);
    assert.equal(run(root, 'status').json.revision, 3);
  });

  it('rejects a well-formed ledger event with an illegal transition', () => {
    const root = makeRepo();
    init(root, { second: false });
    const ledger = path.join(root, '.omj/goals/demo/ledger.jsonl');
    appendFileSync(ledger, `${JSON.stringify({ seq: 2, ts: new Date().toISOString(), type: 'goal_completed', goalId: 'G1', completion: {} })}\n`);
    const result = run(root, 'status');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /illegal goal_completed/);
  });
});

describe('goal-state evidence freshness', () => {
  it('rejects failed and stale command proof, while unchanged fingerprints remain usable', () => {
    const root = makeRepo();
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    const check = ['node', '-e', "process.exit(require('node:fs').readFileSync('app.txt','utf8') === 'base\\n' ? 0 : 7)"];
    writeFileSync(path.join(root, 'app.txt'), 'dirty\n');
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: check });
    assert.equal(result.json.exitCode, 7);
    const acceptanceEvidence = [{ criterion: 'first behavior works', evidence: 'behavior observed in the recorded proof' }];
    let rejected = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence });
    assert.equal(rejected.code, 1);
    assert.match(rejected.stderr, /missing, failed, or stale/);

    writeFileSync(path.join(root, 'app.txt'), 'base\n');
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: check });
    let missingReview = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence });
    assert.equal(missingReview.code, 1);
    assert.match(missingReview.stderr, /review pass/);
    result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, reviewer: 'reviewer', verdict: 'pass', summary: 'Review passed.' });
    writeFileSync(path.join(root, 'app.txt'), 'dirty\n');
    rejected = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence });
    assert.equal(rejected.code, 1);
    assert.match(rejected.stderr, /stale/);

    writeFileSync(path.join(root, 'app.txt'), 'base\n');
    const completed = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence });
    assert.equal(completed.code, 0, completed.stderr);
  });

  it('does not allow a false close without final current proof and review', () => {
    const root = makeRepo();
    const created = init(root, { second: false });
    const revision = passGoal(root, created.json.revision, 'G1');
    let closed = run(root, 'close', { expectedRevision: revision });
    assert.equal(closed.code, 1);
    assert.match(closed.stderr, /final proof/);
    const finalRevision = finalProof(root, revision);
    writeFileSync(path.join(root, 'app.txt'), 'changed after final audit\n');
    closed = run(root, 'close', { expectedRevision: finalRevision });
    assert.equal(closed.code, 1);
    assert.match(closed.stderr, /stale final proof/);
  });

  it('lets a later failure for the same command override an earlier pass', () => {
    const root = makeRepo();
    const switchFile = path.join(tmpdir(), `omj-command-switch-${process.pid}-${Date.now()}`);
    writeFileSync(switchFile, 'pass');
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    const argv = ['node', '-e', `process.exit(require('node:fs').readFileSync(${JSON.stringify(switchFile)},'utf8') === 'pass' ? 0 : 9)`];
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv });
    result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, reviewer: 'reviewer', verdict: 'pass', summary: 'Reviewed.' });
    writeFileSync(switchFile, 'fail');
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv });
    assert.equal(result.json.exitCode, 9);
    const completed = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'covered by the recorded proof' }] });
    assert.equal(completed.code, 1);
    assert.match(completed.stderr, /failed/);
    rmSync(switchFile, { force: true });
  });

  it('lets a later failing review override an earlier pass at the same fingerprint', () => {
    const root = makeRepo();
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'process.exit(0)'] });
    result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, reviewer: 'reviewer-1', verdict: 'pass', summary: 'Initially clear.' });
    result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, reviewer: 'reviewer-2', verdict: 'fail', summary: 'Found a blocking regression.' });
    const completed = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'covered by the recorded proof' }] });
    assert.equal(completed.code, 1);
    assert.match(completed.stderr, /failed.*review pass/);
  });

  it('rejects a passing command that changes the checked workspace and detects artifact tampering', () => {
    const root = makeRepo();
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', "require('node:fs').writeFileSync('app.txt','generated\\n')"] });
    assert.equal(result.json.exitCode, 0);
    assert.equal(result.json.stable, false);
    let completed = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'covered by the recorded proof' }] });
    assert.equal(completed.code, 1);

    writeFileSync(path.join(root, 'app.txt'), 'base\n');
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'process.exit(0)'] });
    unlinkSync(path.join(root, '.omj/goals/demo', result.json.artifact));
    const status = run(root, 'status');
    assert.equal(status.code, 1);
    assert.match(status.stderr, /artifact missing or tampered/);
  });

  it('rejects a verification cwd symlink that escapes the repository', () => {
    const root = makeRepo();
    const outside = mkdtempSync(path.join(tmpdir(), 'omj-outside-'));
    roots.push(outside);
    symlinkSync(outside, path.join(root, 'outside-link'));
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'process.exit(0)'], cwd: 'outside-link' });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /cwd must stay inside/);
  });
});

describe('goal-state PR receipts', () => {
  it('requires dispositions and per-finding current delivery readbacks, then closes after a real commit', () => {
    const root = makeRepo();
    const baseline = git(root, 'rev-parse', 'HEAD');
    const pr = {
      host: 'github.com', repo: 'acme/widget', number: 42, headSha: baseline, deliveryRequired: true,
      findings: [{ id: 'F1', title: 'Bug' }, { id: 'F2', title: 'Style' }],
    };
    let result = init(root, { second: false, pr });
    let revision = passGoal(root, result.json.revision, 'G1');
    result = run(root, 'finding', { expectedRevision: revision, id: 'F1', disposition: 'accepted', rationale: 'Fixed the bug.' });

    writeFileSync(path.join(root, 'app.txt'), 'fixed\n');
    git(root, 'add', 'app.txt');
    git(root, 'commit', '-qm', 'fix findings');
    const currentHead = git(root, 'rev-parse', 'HEAD');
    revision = finalProof(root, result.json.revision);

    let closed = run(root, 'close', { expectedRevision: revision });
    assert.equal(closed.code, 1);
    assert.match(closed.stderr, /all PR findings/);
    result = run(root, 'finding', { expectedRevision: revision, id: 'F2', disposition: 'rejected', rationale: 'Existing contract requires this shape.' });

    result = run(root, 'delivery', {
      expectedRevision: result.json.revision,
      url: 'https://github.com/acme/widget/pull/42',
      headSha: currentHead,
      replies: [{ findingId: 'F1', url: 'https://github.com/acme/widget/pull/42/files#r1' }],
    });
    assert.equal(result.code, 0, result.stderr);
    closed = run(root, 'close', { expectedRevision: result.json.revision });
    assert.equal(closed.code, 1);
    assert.match(closed.stderr, /one reply receipt URL per finding/);

    result = run(root, 'delivery', {
      expectedRevision: result.json.revision,
      url: 'https://github.com/acme/widget/pull/42',
      headSha: currentHead,
      replies: [
        { findingId: 'F1', url: 'https://github.com/acme/widget/pull/42/files#r1' },
        { findingId: 'F2', url: 'https://github.com/acme/widget/pull/42#discussion-diff-2' },
      ],
    });
    closed = run(root, 'close', { expectedRevision: result.json.revision });
    assert.equal(closed.code, 0, closed.stderr);
  });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
};
async function waitGone(pid, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!alive(pid)) return true;
    await sleep(25);
  }
  return !alive(pid);
}

const BENCH = `import { readFileSync } from 'node:fs';
const value = readFileSync('src/value.txt', 'utf8').trim();
if (value === 'boom') process.exit(3);
if (value === 'sleep') setTimeout(() => {}, 5000);
else if (value !== 'silent') console.log('METRIC cost=' + Number(value));
`;

function makeExperimentRepo() {
  const root = makeRepo();
  mkdirSync(path.join(root, 'src'));
  mkdirSync(path.join(root, 'bench'));
  mkdirSync(path.join(root, 'test'));
  writeFileSync(path.join(root, 'src/value.txt'), '100\n');
  writeFileSync(path.join(root, 'bench/bench.mjs'), BENCH);
  writeFileSync(path.join(root, 'test/check.mjs'), "import { readFileSync } from 'node:fs';\nprocess.exit(Number(readFileSync('src/value.txt', 'utf8')) >= 0 ? 0 : 1);\n");
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'experiment fixture');
  return root;
}

const experimentGoal = (overrides = {}) => ({
  id: 'E1',
  title: 'Lower cost',
  objective: 'Lower the cost metric',
  kind: 'experiment',
  acceptance: ['best cost is recorded against the baseline'],
  experiment: {
    metric: { name: 'cost', direction: 'lower', deterministic: true },
    evaluator: { argv: ['node', 'bench/bench.mjs'], repeats: 1, timeoutSeconds: 30 },
    guards: [{ argv: ['node', 'test/check.mjs'] }],
    scope: ['src/'],
    sealed: ['bench/', 'test/'],
    maxTrials: 5,
    ...overrides,
  },
});

const setValue = (root, value) => writeFileSync(path.join(root, 'src/value.txt'), `${value}\n`);
const trial = (root, revision, hypothesis, extra = {}) => run(root, 'trial', { expectedRevision: revision, goalId: 'E1', hypothesis, ...extra });
const expStatus = (root) => run(root, 'status').json;

function startExperiment(root, overrides) {
  let result = run(root, 'init', { brief: '# Approved plan\n', goals: [experimentGoal(overrides)] });
  assert.equal(result.code, 0, result.stderr);
  result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'E1' });
  assert.equal(result.code, 0, result.stderr);
  return result.json.revision;
}

function baseline(root, overrides) {
  const result = trial(root, startExperiment(root, overrides), 'baseline');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.json.decision, 'baseline');
  return result.json.revision;
}

function completeExperiment(root, revision) {
  let result = run(root, 'verify', { expectedRevision: revision, scope: { goalId: 'E1' }, argv: ['node', 'test/check.mjs'] });
  assert.equal(result.code, 0, result.stderr);
  result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'E1' }, reviewer: 'critic-agent', verdict: 'pass', summary: 'No metric gaming.' });
  assert.equal(result.code, 0, result.stderr);
  return run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'E1', acceptanceEvidence: [{ criterion: 'best cost is recorded against the baseline', evidence: 'trial table in the ledger' }] });
}

describe('goal-state experiment goals', () => {
  it('rejects invalid experiment configurations at init', () => {
    const root = makeExperimentRepo();
    writeFileSync(path.join(root, '.gitignore'), 'ignored/\n');
    git(root, 'add', '.gitignore');
    git(root, 'commit', '-qm', 'ignore');
    const cases = [
      [{ metric: { name: 'cost', direction: 'sideways', deterministic: true } }, /direction must be lower or higher/],
      [{ metric: { name: 'cost', direction: 'lower' }, evaluator: { argv: ['node', 'bench/bench.mjs'], repeats: 1 } }, /repeats of 3 or more/],
      [{ scope: ['bench/bench.mjs'] }, /scope and sealed overlap/],
      [{ scope: ['ignored/x.txt'] }, /ignored by git/],
      [{ scope: ['src'] }, /directory entries end with \//],
      [{ scope: ['src/fast'], sealed: ['src/fast/fixtures/'] }, /scope and sealed overlap/],
      [{ guards: [] }, /at least one guard/],
      [{ maxTrials: undefined }, /maxTrials must be an integer/],
    ];
    for (const [overrides, pattern] of cases) {
      const result = run(root, 'init', { brief: '# Approved plan\n', goals: [experimentGoal(overrides)] });
      assert.equal(result.code, 1, `expected ${pattern} to reject`);
      assert.match(result.stderr, pattern);
    }
    const misplaced = run(root, 'init', { brief: '# Approved plan\n', goals: [{ ...goals(false)[0], experiment: experimentGoal().experiment }] });
    assert.match(misplaced.stderr, /only valid on experiment goals/);
  });

  it('keeps a measured improvement and restores the scope exactly on discard', () => {
    const root = makeExperimentRepo();
    let revision = baseline(root);
    setValue(root, 80);
    let result = trial(root, revision, 'lower the value');
    assert.equal(result.json.decision, 'keep', result.stderr);
    assert.equal(result.json.best.value, 80);
    setValue(root, 90);
    writeFileSync(path.join(root, 'src/extra.txt'), 'created during the trial\n');
    chmodSync(path.join(root, 'src/value.txt'), 0o755);
    result = trial(root, result.json.revision, 'raise it again');
    assert.equal(result.json.decision, 'discard', result.stderr);
    assert.equal(result.json.restored, true);
    assert.equal(readFileSync(path.join(root, 'src/value.txt'), 'utf8'), '80\n');
    assert.equal(statSync(path.join(root, 'src/value.txt')).mode & 0o777, 0o644);
    assert.equal(existsSync(path.join(root, 'src/extra.txt')), false);
    const kept = JSON.parse(readFileSync(path.join(root, '.omj/goals/demo', result.json.artifact), 'utf8'));
    assert.equal(Buffer.from(kept.candidate.files['src/value.txt'].base64, 'base64').toString(), '90\n');
    assert.ok(kept.candidate.files['src/extra.txt']);
    assert.equal(expStatus(root).experimentStatus.E1.atBest, true);
    revision = result.json.revision;
    assert.equal(completeExperiment(root, revision).code, 0);
  });

  it('binds the baseline to the starting scope, rebinds on resume, and refuses trials after HEAD moves', () => {
    const root = makeExperimentRepo();
    let revision = startExperiment(root);
    setValue(root, 500);
    const degraded = trial(root, revision, 'baseline');
    assert.equal(degraded.code, 1);
    assert.match(degraded.stderr, /scope changed since the goal started/);
    let result = run(root, 'block', { expectedRevision: revision, goalId: 'E1', reason: 'the user fixes the starting code' });
    setValue(root, 120);
    result = run(root, 'resume', { expectedRevision: result.json.revision, goalId: 'E1' });
    result = trial(root, result.json.revision, 'baseline');
    assert.equal(result.json.decision, 'baseline', result.stderr);
    assert.equal(result.json.value, 120);
    writeFileSync(path.join(root, 'app.txt'), 'moved\n');
    git(root, 'commit', '-qam', 'move HEAD');
    const moved = trial(root, result.json.revision, 'after the move');
    assert.match(moved.stderr, /HEAD moved since baseline/);

    const other = makeExperimentRepo();
    revision = startExperiment(other);
    writeFileSync(path.join(other, 'notes.txt'), 'outside the scope\n');
    assert.equal(trial(other, revision, 'baseline').json.decision, 'baseline');
  });

  it('treats sealed and out-of-scope edits as invalid and restores sealed files', () => {
    const root = makeExperimentRepo();
    writeFileSync(path.join(root, 'bench/data.json'), '{"n":1}\n');
    let revision = baseline(root);
    writeFileSync(path.join(root, 'bench/bench.mjs'), 'console.log("METRIC cost=1")\n');
    writeFileSync(path.join(root, 'bench/data.json'), '{"n":2}\n');
    setValue(root, 50);
    let result = trial(root, revision, 'rewrite the benchmark');
    assert.equal(result.json.decision, 'invalid', result.stderr);
    assert.match(result.json.reason, /sealed file changed: bench\//);
    assert.equal(readFileSync(path.join(root, 'bench/bench.mjs'), 'utf8'), BENCH);
    assert.equal(readFileSync(path.join(root, 'bench/data.json'), 'utf8'), '{"n":1}\n');
    assert.equal(readFileSync(path.join(root, 'src/value.txt'), 'utf8'), '100\n');
    assert.equal(result.json.restored, true);
    const invalid = JSON.parse(readFileSync(path.join(root, '.omj/goals/demo', result.json.artifact), 'utf8'));
    assert.equal(Buffer.from(invalid.sealedCandidate.files['bench/data.json'].base64, 'base64').toString(), '{"n":2}\n');
    writeFileSync(path.join(root, 'app.txt'), 'outside edit\n');
    setValue(root, 60);
    result = trial(root, result.json.revision, 'edit outside');
    assert.equal(result.json.decision, 'invalid');
    assert.match(result.json.reason, /edit outside scope: app\.txt/);
    assert.equal(result.json.restored, false);
    revision = result.json.revision;
    assert.equal(expStatus(root).experimentStatus.E1.atBest, false);
  });

  it('records crashes, timeouts, and guard failures and restores the scope', () => {
    const root = makeExperimentRepo();
    let revision = baseline(root, { evaluator: { argv: ['node', 'bench/bench.mjs'], repeats: 1, timeoutSeconds: 1 } });
    for (const [value, pattern] of [['boom', /evaluator exited 3/], ['silent', /no METRIC cost= line/], ['abc', /METRIC cost= value is not a finite number: NaN/], ['sleep', /evaluator timed out/]]) {
      setValue(root, value);
      const started = Date.now();
      const result = trial(root, revision, `try ${value}`);
      assert.equal(result.json.decision, 'crash', result.stderr);
      assert.match(result.json.reason, pattern);
      assert.equal(readFileSync(path.join(root, 'src/value.txt'), 'utf8'), '100\n');
      assert.ok(Date.now() - started < 4500);
      revision = result.json.revision;
    }
    setValue(root, -10);
    const guarded = trial(root, revision, 'negative cost');
    assert.equal(guarded.json.decision, 'guard_failed', guarded.stderr);
    assert.equal(readFileSync(path.join(root, 'src/value.txt'), 'utf8'), '100\n');
  });

  it('fails before the marker when the evaluator cwd does not exist', () => {
    const root = makeExperimentRepo();
    const revision = startExperiment(root, { evaluator: { argv: ['node', 'bench/bench.mjs'], cwd: 'missing', repeats: 1, timeoutSeconds: 30 } });
    const result = trial(root, revision, 'baseline');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /cwd must name an existing directory/);
    assert.equal(existsSync(path.join(root, '.omj/goals/demo/trial.pending.json')), false);
    assert.equal(expStatus(root).experiments.E1.trials.length, 0);
  });

  it('records a restore failure as a helper error that spends budget', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
    const root = makeExperimentRepo();
    const marker = path.join(root, '.omj/goals/demo/trial.pending.json');
    const valueFile = path.join(root, 'src/value.txt');
    let revision = baseline(root);
    setValue(root, 80);
    let result = trial(root, revision, 'lower the value');
    assert.equal(result.json.decision, 'keep', result.stderr);
    revision = result.json.revision;
    setValue(root, 90);
    chmodSync(valueFile, 0o444);
    result = trial(root, revision, 'raise it again');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /EACCES/);
    assert.equal(existsSync(marker), true);
    assert.match(JSON.parse(readFileSync(marker, 'utf8')).error, /EACCES/);
    assert.match(expStatus(root).experimentStatus.E1.pendingTrial.error, /EACCES/);
    result = trial(root, revision, 'retry while read-only');
    assert.equal(result.code, 1);
    assert.equal(existsSync(marker), true);
    chmodSync(valueFile, 0o644);
    result = trial(root, revision, 'recover');
    assert.equal(result.json.recovered, true, result.stderr);
    assert.equal(result.json.decision, 'crash');
    assert.match(result.json.reason, /^helper error: EACCES/);
    assert.equal(result.json.trialsLeft, 3);
    assert.equal(expStatus(root).experiments.E1.nonKeepStreak, 1);
    assert.equal(readFileSync(valueFile, 'utf8'), '80\n');
    assert.equal(existsSync(marker), false);
  });

  it('fails before the marker when uncommitted sealed files exceed the snapshot limit', () => {
    const root = makeExperimentRepo();
    writeFileSync(path.join(root, 'bench/big.bin'), Buffer.alloc(2 * 1024 * 1024 + 1));
    const revision = startExperiment(root);
    const result = trial(root, revision, 'baseline');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /uncommitted sealed files exceed 2097152 bytes/);
    assert.equal(existsSync(path.join(root, '.omj/goals/demo/trial.pending.json')), false);
    assert.equal(expStatus(root).experiments.E1.trials.length, 0);
  });

  it('counts a helper error before the baseline toward no_baseline', () => {
    const root = makeExperimentRepo();
    const revision = startExperiment(root);
    writeFileSync(path.join(root, '.omj/goals/demo/trial.pending.json'), JSON.stringify({ goalId: 'E1', n: 0, repair: false, hypothesis: 'baseline', pgid: null, error: 'restore failed: EACCES' }));
    const result = trial(root, revision, 'baseline');
    assert.equal(result.json?.reason, 'helper error: restore failed: EACCES', result.stderr);
    const exp = expStatus(root).experiments.E1;
    assert.equal(exp.baselineFailures, 1);
    assert.equal(exp.stopReason, null);
  });

  it('discards an improvement within the baseline spread when repeats are three', () => {
    const root = makeExperimentRepo();
    const counter = path.join(mkdtempSync(path.join(tmpdir(), 'omj-jitter-')), 'count');
    roots.push(path.dirname(counter));
    writeFileSync(path.join(root, 'bench/jitter.mjs'), `import { readFileSync, writeFileSync } from 'node:fs';
let n = 0;
try { n = Number(readFileSync(${JSON.stringify(counter)}, 'utf8')); } catch {}
writeFileSync(${JSON.stringify(counter)}, String(n + 1));
console.log('METRIC cost=' + (Number(readFileSync('src/value.txt', 'utf8')) + [0, 5, -5][n % 3]));
`);
    let revision = baseline(root, { metric: { name: 'cost', direction: 'lower' }, evaluator: { argv: ['node', 'bench/jitter.mjs'], repeats: 3, timeoutSeconds: 30 } });
    assert.equal(expStatus(root).experiments.E1.baseline.spread, 10);
    setValue(root, 97);
    let result = trial(root, revision, 'small change');
    assert.equal(result.json.decision, 'discard', result.stderr);
    assert.equal(result.json.threshold, 10);
    setValue(root, 85);
    result = trial(root, result.json.revision, 'large change');
    assert.equal(result.json.decision, 'keep', result.stderr);
  });

  it('stops on max_trials, plateau, and no_baseline, and completes at a baseline that meets the target', () => {
    let root = makeExperimentRepo();
    let revision = baseline(root, { maxTrials: 1 });
    setValue(root, 110);
    let result = trial(root, revision, 'worse');
    assert.equal(result.json.stopReason, 'max_trials');
    assert.match(trial(root, result.json.revision, 'one more').stderr, /experiment stopped: max_trials/);

    root = makeExperimentRepo();
    revision = baseline(root, { patience: 1 });
    setValue(root, 110);
    result = trial(root, revision, 'worse');
    assert.equal(result.json.stopReason, 'plateau');
    assert.match(trial(root, result.json.revision, 'again').stderr, /experiment stopped: plateau/);

    root = makeExperimentRepo();
    setValue(root, 'boom');
    git(root, 'commit', '-qam', 'broken starting code');
    revision = startExperiment(root);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      result = trial(root, revision, 'baseline');
      assert.equal(result.json.decision, 'crash');
      revision = result.json.revision;
    }
    assert.equal(result.json.stopReason, 'no_baseline');
    assert.match(trial(root, revision, 'baseline').stderr, /experiment stopped: no_baseline/);

    root = makeExperimentRepo();
    revision = baseline(root, { target: 150 });
    assert.equal(expStatus(root).experiments.E1.stopReason, 'target');
    assert.equal(completeExperiment(root, revision).code, 0);
  });

  it('allows a repair only after a failing review at the best state', () => {
    const root = makeExperimentRepo();
    let revision = baseline(root);
    setValue(root, 80);
    let result = trial(root, revision, 'cache the answer');
    assert.equal(result.json.decision, 'keep');
    revision = result.json.revision;
    setValue(root, 90);
    const early = trial(root, revision, 'honest version', { repair: true });
    assert.match(early.stderr, /failing goal review at the best state/);
    revision = run(root, 'review', { expectedRevision: revision, scope: { goalId: 'E1' }, reviewer: 'critic-agent', verdict: 'fail', summary: 'a failing review of an unmeasured edit' }).json.revision;
    assert.match(trial(root, revision, 'honest version', { repair: true }).stderr, /failing goal review at the best state/, 'a failing review away from the best fingerprint does not admit a repair');
    setValue(root, 80);
    revision = run(root, 'review', { expectedRevision: revision, scope: { goalId: 'E1' }, reviewer: 'critic-agent', verdict: 'fail', summary: 'first reading' }).json.revision;
    revision = run(root, 'review', { expectedRevision: revision, scope: { goalId: 'E1' }, reviewer: 'critic-agent', verdict: 'pass', summary: 'second reading' }).json.revision;
    setValue(root, 90);
    assert.match(trial(root, revision, 'honest version', { repair: true }).stderr, /failing goal review at the best state/, 'a later pass at the best fingerprint withdraws the repair');
    setValue(root, 80);
    result = run(root, 'review', { expectedRevision: revision, scope: { goalId: 'E1' }, reviewer: 'critic-agent', verdict: 'fail', summary: 'metric gaming: cached answer' });
    setValue(root, 90);
    result = trial(root, result.json.revision, 'honest version', { repair: true });
    assert.equal(result.json.decision, 'repair', result.stderr);
    assert.equal(result.json.best.value, 90);
    assert.equal(completeExperiment(root, result.json.revision).code, 0);
  });

  it('refuses completion away from the best state, without trials, or below the target', () => {
    let root = makeExperimentRepo();
    let revision = baseline(root);
    assert.match(completeExperiment(root, revision).stderr, /at least one trial after the baseline/);

    root = makeExperimentRepo();
    revision = baseline(root);
    setValue(root, 80);
    revision = trial(root, revision, 'lower').json.revision;
    setValue(root, 70);
    assert.match(completeExperiment(root, revision).stderr, /not at the best measured state/);

    root = makeExperimentRepo();
    revision = baseline(root, { target: 10, maxTrials: 1 });
    setValue(root, 80);
    const result = trial(root, revision, 'lower');
    assert.equal(result.json.stopReason, 'max_trials');
    assert.match(completeExperiment(root, result.json.revision).stderr, /misses the approved target/);
  });

  it('refuses to close after an experiment scope or sealed file changes', () => {
    for (const [file, content, pattern] of [['src/value.txt', '75\n', /scope changed after its best/], ['test/check.mjs', 'process.exit(0)\n', /sealed files changed/]]) {
      const root = makeExperimentRepo();
      let revision = baseline(root);
      setValue(root, 80);
      revision = trial(root, revision, 'lower').json.revision;
      let result = completeExperiment(root, revision);
      assert.equal(result.code, 0, result.stderr);
      writeFileSync(path.join(root, file), content);
      revision = finalProof(root, result.json.revision);
      result = run(root, 'close', { expectedRevision: revision });
      assert.equal(result.code, 1);
      assert.match(result.stderr, pattern);
    }
  });

  it('recovers interrupted trials without spending budget', async () => {
    const root = makeExperimentRepo();
    let revision = baseline(root, { maxTrials: 1 });
    const sleeper = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { detached: true, stdio: 'ignore' });
    const exited = new Promise((resolve) => sleeper.on('exit', resolve));
    const marker = path.join(root, '.omj/goals/demo/trial.pending.json');
    writeFileSync(marker, JSON.stringify({ goalId: 'E1', n: 1, repair: false, hypothesis: 'hung', pgid: sleeper.pid, startedAt: new Date().toISOString() }));
    setValue(root, 70);
    assert.equal(expStatus(root).experimentStatus.E1.pendingTrial.hypothesis, 'hung');
    assert.match(run(root, 'complete', { expectedRevision: revision, goalId: 'E1', acceptanceEvidence: [] }).stderr, /pending trial names this goal/);
    let result = trial(root, revision, 'next idea');
    assert.equal(result.json.recovered, true, result.stderr);
    assert.equal(result.json.reason, 'interrupted');
    assert.equal(result.json.trialsLeft, 1);
    assert.equal(readFileSync(path.join(root, 'src/value.txt'), 'utf8'), '100\n');
    assert.equal(existsSync(marker), false);
    await Promise.race([exited, sleep(2000)]);
    assert.notEqual(sleeper.signalCode ?? sleeper.exitCode, null, 'the recorded process group was killed');

    writeFileSync(marker, JSON.stringify({ goalId: 'E1', n: 0, repair: false, hypothesis: 'old', pgid: null }));
    result = trial(root, result.json.revision, 'recover the stale marker');
    assert.equal(result.json.alreadyRecorded, true, result.stderr);
    assert.equal(existsSync(marker), false);
    setValue(root, 110);
    result = trial(root, result.json.revision, 'worse');
    assert.equal(result.json.decision, 'discard', result.stderr);
    assert.equal(result.json.stopReason, 'max_trials');
    revision = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'E1' }, reviewer: 'critic-agent', verdict: 'fail', summary: 'blocking finding' }).json.revision;
    writeFileSync(marker, JSON.stringify({ goalId: 'E1', n: expStatus(root).experiments.E1.trials.length, repair: true, hypothesis: 'repair', pgid: null }));
    result = trial(root, revision, 'repair', { repair: true });
    assert.equal(result.json.recovered, true, result.stderr);
    const status = run(root, 'status');
    assert.equal(status.code, 0, status.stderr);
    assert.equal(status.json.experiments.E1.trials.at(-1).repair, true);

    const fresh = makeExperimentRepo();
    revision = startExperiment(fresh);
    writeFileSync(path.join(fresh, '.omj/goals/demo/trial.pending.json'), JSON.stringify({ goalId: 'E1', n: 0, repair: false, hypothesis: 'baseline', pgid: null }));
    result = trial(fresh, revision, 'baseline');
    assert.equal(result.json.recovered, true, result.stderr);
    assert.equal(expStatus(fresh).experiments.E1.baselineFailures, 0);
    result = trial(fresh, result.json.revision, 'baseline');
    assert.equal(result.json.decision, 'baseline');

    writeFileSync(path.join(fresh, '.omj/goals/demo/trial.pending.json'), JSON.stringify({ goalId: 'E1', n: expStatus(fresh).experiments.E1.trials.length, repair: false, hypothesis: 'broke the helper', pgid: null, error: 'restore failed: EACCES' }));
    result = trial(fresh, result.json.revision, 'recover');
    assert.equal(result.json.reason, 'helper error: restore failed: EACCES', result.stderr);
    assert.equal(result.json.trialsLeft, 4, 'a helper error is counted like a crash');
  });

  it('kills the command group when the runner receives SIGTERM', { skip: process.platform === 'win32' }, async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'omj-runner-'));
    roots.push(dir);
    const marker = path.join(dir, 'marker.json');
    writeFileSync(marker, JSON.stringify({ goalId: 'E1', n: 0, pgid: null }));
    const spec = path.join(dir, 'spec.json');
    writeFileSync(spec, JSON.stringify({
      argv: [process.execPath, '-e', 'setTimeout(() => {}, 20000)'], cwd: dir, timeoutMs: null,
      stdoutPath: path.join(dir, 'out'), stderrPath: path.join(dir, 'err'), resultPath: path.join(dir, 'result.json'), markerPath: marker,
    }));
    const runner = spawn(process.execPath, [SCRIPT, '__run', spec], { stdio: 'ignore' });
    let pgid = null;
    for (let attempt = 0; attempt < 80 && !pgid; attempt += 1) {
      await sleep(25);
      pgid = JSON.parse(readFileSync(marker, 'utf8')).pgid;
    }
    assert.ok(pgid, 'the runner records the command pgid');
    runner.kill('SIGTERM');
    assert.ok(await waitGone(pgid, 2000), 'the command group ends with the runner');
  });

  it('rejects a tampered snapshot or trial artifact', () => {
    const root = makeExperimentRepo();
    let revision = baseline(root);
    setValue(root, 80);
    const kept = trial(root, revision, 'lower');
    const state = expStatus(root);
    const snapshot = state.experiments.E1.best.snapshot.artifact;
    appendFileSync(path.join(root, '.omj/goals/demo', snapshot), ' ');
    assert.match(run(root, 'status').stderr, /artifact missing or tampered/);

    const other = makeExperimentRepo();
    revision = baseline(other);
    const recorded = expStatus(other).experiments.E1.trials[0].artifact;
    appendFileSync(path.join(other, '.omj/goals/demo', recorded), ' ');
    assert.match(run(other, 'status').stderr, /artifact missing or tampered/);
    assert.equal(kept.code, 0);
  });
});

describe('goal-state final review reuse, timeouts, and flaky reporting', () => {
  function completeSingle(root) {
    let result = init(root, { second: false });
    const revision = passGoal(root, result.json.revision, 'G1');
    result = run(root, 'verify', { expectedRevision: revision, scope: 'final', argv: ['node', '-e', 'process.exit(0)'] });
    assert.equal(result.code, 0, result.stderr);
    return result.json.revision;
  }

  it('reuses the single goal review only when explicitly flagged and nothing changed', () => {
    let root = makeRepo();
    let revision = completeSingle(root);
    assert.match(run(root, 'close', { expectedRevision: revision }).stderr, /final independent review/);
    let closed = run(root, 'close', { expectedRevision: revision, reuseGoalReview: true });
    assert.equal(closed.code, 0, closed.stderr);
    assert.equal(closed.json.finalReview.reused, true);
    assert.equal(run(root, 'status').json.closed, true);

    root = makeRepo();
    let result = init(root);
    revision = passGoal(root, result.json.revision, 'G1');
    revision = passGoal(root, revision, 'G2');
    revision = run(root, 'verify', { expectedRevision: revision, scope: 'final', argv: ['node', '-e', 'process.exit(0)'] }).json.revision;
    assert.match(run(root, 'close', { expectedRevision: revision, reuseGoalReview: true }).stderr, /exactly one goal/);

    root = makeRepo();
    revision = completeSingle(root);
    writeFileSync(path.join(root, 'app.txt'), 'edited after the goal review\n');
    revision = run(root, 'verify', { expectedRevision: revision, scope: 'final', argv: ['node', '-e', 'process.exit(0)'] }).json.revision;
    assert.match(run(root, 'close', { expectedRevision: revision, reuseGoalReview: true }).stderr, /unchanged since the goal review/);

    root = makeRepo();
    revision = completeSingle(root);
    revision = run(root, 'review', { expectedRevision: revision, scope: 'final', reviewer: 'final-reviewer', verdict: 'fail', summary: 'blocking finding' }).json.revision;
    assert.match(run(root, 'close', { expectedRevision: revision, reuseGoalReview: true }).stderr, /a final review exists/);
  });

  it('times out a command and does not wait for a lingering grandchild', async () => {
    const root = makeRepo();
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    let started = Date.now();
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'console.log("waiting"); setTimeout(() => {}, 5000)'], timeoutSeconds: 1 });
    assert.equal(result.json.exitCode, 124, result.stderr);
    assert.equal(result.json.timedOut, true);
    assert.deepEqual(result.json.excerpt, { stdout: 'waiting', stderr: '' });
    assert.ok(Date.now() - started < 4500);
    started = Date.now();
    result = run(root, 'verify', {
      expectedRevision: result.json.revision,
      scope: { goalId: 'G1' },
      argv: ['node', '-e', "const c = require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { stdio: 'inherit' }); c.unref(); console.log(c.pid);"],
    });
    assert.equal(result.json.exitCode, 0, result.stderr);
    assert.ok(Date.now() - started < 4000, 'the helper returns without waiting for the grandchild');
    if (process.platform !== 'win32') {
      const recorded = JSON.parse(readFileSync(path.join(root, '.omj/goals/demo', result.json.artifact), 'utf8'));
      assert.ok(await waitGone(Number(recorded.stdout.trim()), 500), 'the grandchild in the command group is gone');
    }
  });

  it('reports a command that failed and then passed on the same fingerprint', () => {
    const root = makeRepo();
    const flag = path.join(mkdtempSync(path.join(tmpdir(), 'omj-flaky-')), 'flag');
    roots.push(path.dirname(flag));
    writeFileSync(flag, 'fail');
    const argv = ['node', '-e', `process.exit(require('node:fs').readFileSync(${JSON.stringify(flag)}, 'utf8') === 'pass' ? 0 : 1)`];
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv });
    assert.equal(result.json.exitCode, 1);
    writeFileSync(flag, 'pass');
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv });
    assert.equal(result.json.exitCode, 0);
    const flaky = run(root, 'status').json.flakyChecks;
    assert.equal(flaky.length, 1);
    assert.deepEqual(flaky[0].exitCodes, [1, 0]);
  });
});

describe('goal-state final proof reuse', () => {
  function counterCommand() {
    const counter = path.join(mkdtempSync(path.join(tmpdir(), 'omj-counter-')), 'count');
    roots.push(path.dirname(counter));
    return { counter, argv: ['node', '-e', `require('node:fs').appendFileSync(${JSON.stringify(counter)}, 'x')`] };
  }

  function refuses(root, input, pattern) {
    const revision = run(root, 'status').json.revision;
    const result = run(root, 'verify', { expectedRevision: revision, ...input });
    assert.equal(result.code, 1);
    assert.match(result.stderr, pattern);
    assert.equal(run(root, 'status').json.revision, revision, 'a refusal appends nothing');
  }

  const noStablePass = /no stable pass of this command on the current fingerprint/;

  it('records an earlier stable pass as the final proof without running the command again', () => {
    const root = makeRepo();
    const { counter, argv } = counterCommand();
    const revision = passGoal(root, init(root, { second: false }).json.revision, 'G1', argv);
    assert.equal(statSync(counter).size, 1);
    const [source] = run(root, 'status').json.proofs;
    let result = run(root, 'verify', { expectedRevision: revision, scope: 'final', argv, reuse: true });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.json.reused, true);
    assert.equal(result.json.artifact, source.artifact);
    assert.equal('excerpt' in result.json, false);
    assert.equal(statSync(counter).size, 1, 'the command did not run again');
    const ledger = readFileSync(path.join(root, '.omj/goals/demo/ledger.jsonl'), 'utf8').trimEnd().split('\n');
    assert.deepEqual(JSON.parse(ledger.at(-1)).proof, { ...source, scope: 'final', reused: true });
    result = run(root, 'review', { expectedRevision: result.json.revision, scope: 'final', reviewer: 'final-reviewer', verdict: 'pass', summary: 'Final diff passes review.' });
    const closed = run(root, 'close', { expectedRevision: result.json.revision });
    assert.equal(closed.code, 0, closed.stderr);
  });

  it('runs the final command when reuse is absent and rejects a non-boolean reuse', () => {
    const root = makeRepo();
    const { counter, argv } = counterCommand();
    passGoal(root, init(root, { second: false }).json.revision, 'G1', argv);
    refuses(root, { scope: 'final', argv, reuse: 'yes' }, /reuse must be a boolean/);
    const result = run(root, 'verify', { expectedRevision: run(root, 'status').json.revision, scope: 'final', argv });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.json.reused, false);
    assert.equal(statSync(counter).size, 2);
  });

  it('refuses reuse for another cwd or a changed workspace', () => {
    const root = makeRepo();
    const { argv } = counterCommand();
    passGoal(root, init(root, { second: false }).json.revision, 'G1', argv);
    mkdirSync(path.join(root, 'sub'));
    refuses(root, { scope: 'final', argv, cwd: 'sub', reuse: true }, noStablePass);
    writeFileSync(path.join(root, 'app.txt'), 'edited after the goal\n');
    refuses(root, { scope: 'final', argv, reuse: true }, noStablePass);
    writeFileSync(path.join(root, 'app.txt'), 'base\n');
    const result = run(root, 'verify', { expectedRevision: run(root, 'status').json.revision, scope: 'final', argv, cwd: '.', reuse: true });
    assert.equal(result.json?.reused, true, result.stderr);
  });

  it('refuses reuse when any run of the command failed on the current fingerprint', () => {
    const root = makeRepo();
    const flag = path.join(mkdtempSync(path.join(tmpdir(), 'omj-flaky-')), 'flag');
    roots.push(path.dirname(flag));
    writeFileSync(flag, 'fail');
    const argv = ['node', '-e', `process.exit(require('node:fs').readFileSync(${JSON.stringify(flag)}, 'utf8') === 'pass' ? 0 : 1)`];
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv });
    assert.equal(result.json.exitCode, 1);
    writeFileSync(flag, 'pass');
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv });
    assert.equal(result.json.exitCode, 0);
    result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, reviewer: 'reviewer', verdict: 'pass', summary: 'Reviewed.' });
    result = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'covered by the recorded proof' }] });
    assert.equal(result.code, 0, result.stderr);
    refuses(root, { scope: 'final', argv, reuse: true }, noStablePass);
  });

  it('refuses reuse when a run of the command changed the workspace on the current fingerprint', () => {
    const root = makeRepo();
    const argv = ['node', '-e', "const fs = require('node:fs'); if (!fs.existsSync('out.txt')) fs.writeFileSync('out.txt', 'x')"];
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv });
    assert.equal(result.json.stable, false);
    const changed = result.json.fingerprint;
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv });
    assert.equal(result.json.stable, true);
    assert.equal(result.json.fingerprint, changed, 'both runs end on the same fingerprint');
    result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, reviewer: 'reviewer', verdict: 'pass', summary: 'Reviewed.' });
    result = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'covered by the recorded proof' }] });
    assert.equal(result.code, 0, result.stderr);
    refuses(root, { scope: 'final', argv, reuse: true }, noStablePass);
  });

  it('refuses reuse at goal scope and on a schema v2 ledger', () => {
    const argv = ['node', '-e', 'process.exit(0)'];
    const root = makeRepo();
    let result = init(root, { second: false });
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv });
    refuses(root, { scope: { goalId: 'G1' }, argv, reuse: true }, /reuse is only valid for final scope/);

    const old = makeRepo();
    const v2 = (verb, input) => run(old, verb, input, 'demo', V2_SCRIPT);
    result = v2('init', { brief: '# Approved plan\n', goals: goals(false) });
    result = v2('start', { expectedRevision: result.json.revision, goalId: 'G1' });
    result = v2('verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv });
    result = v2('review', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, reviewer: 'reviewer', verdict: 'pass', summary: 'Reviewed.' });
    result = v2('complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'verified' }] });
    assert.equal(result.code, 0, result.stderr);
    refuses(old, { scope: 'final', argv, reuse: true }, /reuse requires a schema v3 ledger/);
  });
});

describe('goal-state verification output excerpts', () => {
  function activeGoal(root) {
    const result = run(root, 'start', { expectedRevision: init(root, { second: false }).json.revision, goalId: 'G1' });
    assert.equal(result.code, 0, result.stderr);
    return result.json.revision;
  }

  const verifyG1 = (root, revision, argv) => run(root, 'verify', { expectedRevision: revision, scope: { goalId: 'G1' }, argv });

  it('keeps the last 20 non-empty lines without ANSI escapes and leaves the artifact raw', () => {
    const root = makeRepo();
    const colored = "for (let i = 1; i <= 100; i += 1) process.stdout.write(`\\u001b[3${i % 8}mline ${i}\\u001b[0m\\r\\n\\r\\n`); process.exit(3)";
    const result = verifyG1(root, activeGoal(root), ['node', '-e', colored]);
    assert.equal(result.json.exitCode, 3, result.stderr);
    assert.equal(result.json.reused, false);
    const { stdout, stderr } = result.json.excerpt;
    const lines = stdout.split('\n');
    assert.equal(lines.length, 20);
    assert.equal(lines[0], 'line 81');
    assert.equal(lines.at(-1), 'line 100');
    assert.doesNotMatch(stdout, /[\u001b\r]/);
    assert.ok(stdout.length <= 2000);
    assert.equal(stderr, '');
    const recorded = JSON.parse(readFileSync(path.join(root, '.omj/goals/demo', result.json.artifact), 'utf8'));
    assert.match(recorded.stdout, /\u001b\[31mline 97\u001b\[0m\r\n/);
    assert.equal('excerpt' in recorded, false);
  });

  it('cuts a long line to its last 2,000 characters and shows the output of a passing command', () => {
    const root = makeRepo();
    const line = `${'x'.repeat(5_000)}${'y'.repeat(4_990)}tail-of-it`;
    let result = verifyG1(root, activeGoal(root), ['node', '-e', `process.stdout.write(${JSON.stringify(line)})`]);
    assert.equal(result.json.excerpt.stdout, line.slice(-2_000));
    result = verifyG1(root, result.json.revision, ['node', '-e', 'console.log("# tests 1"); console.error("a warning")']);
    assert.equal(result.json.exitCode, 0);
    assert.match(result.json.excerpt.stdout, /^# tests 1$/m);
    assert.equal(result.json.excerpt.stderr, 'a warning');
    assert.equal('error' in result.json, false);
  });

  it('returns the runner error, cut to 500 characters, when the command cannot start', () => {
    const root = makeRepo();
    let result = verifyG1(root, activeGoal(root), ['omj-no-such-binary-xyz']);
    assert.notEqual(result.json.exitCode, 0);
    assert.match(result.json.error, /omj-no-such-binary-xyz/);
    assert.deepEqual(result.json.excerpt, { stdout: '', stderr: '' });
    const missing = path.join(tmpdir(), 'omj-no-such-dir', 'd'.repeat(200), 'd'.repeat(200), 'd'.repeat(200), 'omj-no-such-binary-xyz');
    result = verifyG1(root, result.json.revision, [missing]);
    assert.notEqual(result.json.exitCode, 0);
    assert.equal(result.json.error.length, 500);
    const recorded = JSON.parse(readFileSync(path.join(root, '.omj/goals/demo', result.json.artifact), 'utf8'));
    assert.ok(recorded.error.length > 500, 'the artifact keeps the full error');
  });
});

describe('goal-state schema v2 compatibility', () => {
  it('resumes and closes a ledger written by the 0.13.0 helper with v2 semantics', () => {
    const root = makeRepo();
    let result = run(root, 'init', { brief: '# Approved plan\n', goals: goals(false) }, 'demo', V2_SCRIPT);
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' }, 'demo', V2_SCRIPT);
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'process.exit(0)'] }, 'demo', V2_SCRIPT);
    assert.equal(result.code, 0, result.stderr);
    const snapshotPath = path.join(root, '.omj/goals/demo/goals.json');
    const written = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    assert.equal(written.schemaVersion, 2);

    const status = run(root, 'status');
    assert.equal(status.code, 0, status.stderr);
    assert.equal(status.json.snapshotStatus, 'ok');
    assert.equal(status.json.schemaVersion, 2);
    const derivedKeys = Object.keys(status.json).filter((key) => !['snapshotStatus', 'flakyChecks'].includes(key)).sort();
    assert.deepEqual(derivedKeys, Object.keys(written).sort());
    assert.match(run(root, 'trial', { expectedRevision: result.json.revision, goalId: 'G1', hypothesis: 'x' }).stderr, /schema v3/);

    result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, reviewer: 'independent-reviewer', verdict: 'pass', summary: 'No blocking findings.' });
    result = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'verified' }] });
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: 'final', argv: ['node', '-e', 'process.exit(0)'] });
    assert.match(run(root, 'close', { expectedRevision: result.json.revision, reuseGoalReview: true }).stderr, /schema v3/);
    const revision = run(root, 'review', { expectedRevision: result.json.revision, scope: 'final', reviewer: 'final-reviewer', verdict: 'pass', summary: 'Final diff passes review.' }).json.revision;
    const closed = run(root, 'close', { expectedRevision: revision });
    assert.equal(closed.code, 0, closed.stderr);
    const after = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    assert.equal(after.schemaVersion, 2);
    assert.deepEqual(Object.keys(after).sort(), Object.keys(written).sort());
    const oldStatus = run(root, 'status', undefined, 'demo', V2_SCRIPT);
    assert.equal(oldStatus.json.closed, true);
    assert.equal(oldStatus.json.snapshotStatus, 'ok', 'the 0.13.0 helper reads the snapshot the new helper wrote as unchanged');
  });
});
