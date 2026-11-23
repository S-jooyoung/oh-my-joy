import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';

import { repoPath } from './helpers/repo.mjs';

const SCRIPT = repoPath('scripts', 'goal-state.mjs');
const V2_SCRIPT = repoPath('tests', 'fixtures', 'goal-state-v2.mjs');
const V15_SCRIPT = repoPath('tests', 'fixtures', 'goal-state-v1.5.mjs');
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
  return run(root, 'init', { brief: '# Approved plan\n', goals: options.goals ?? goals(options.second) });
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

  it('fingerprints .omj config files even when an ignore rule hides .omj/', () => {
    const root = makeRepo();
    writeFileSync(path.join(root, '.gitignore'), '.omj/\n');
    git(root, 'add', '.gitignore');
    git(root, 'commit', '-qm', 'ignore omj');
    const result = init(root, { second: false });
    assert.equal(result.code, 0, result.stderr);
    const started = run(root, 'start', { expectedRevision: result.json.revision, goalId: 'G1' });
    const check = (revision) => run(root, 'verify', { expectedRevision: revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'process.exit(0)'] }).json;
    const before = check(started.json.revision);
    writeFileSync(path.join(root, '.omj/fe-context.md'), 'verifyCommands: changed\n');
    const changed = check(before.revision);
    assert.notEqual(changed.fingerprint, before.fingerprint, 'an ignored .omj/fe-context.md change moves the fingerprint');
    mkdirSync(path.join(root, '.omj/research'), { recursive: true });
    writeFileSync(path.join(root, '.omj/research/notes.md'), 'local notes\n');
    assert.equal(check(changed.revision).fingerprint, changed.fingerprint, 'files under .omj/ subdirectories stay outside the fingerprint');
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


describe('goal-state cross-host review', () => {
  const crossInit = (root) => run(root, 'init', { brief: '# Approved plan\n', goals: goals(false), crossReview: { authorHost: 'claude', mode: 'preferred' } });
  const reviewInput = (revision, extra = {}) => ({ expectedRevision: revision, scope: { goalId: 'G1' }, reviewer: 'codex:critic', verdict: 'pass', summary: 'No blocking findings.', ...extra });

  function verifiedGoal(root) {
    let result = run(root, 'start', { expectedRevision: 1, goalId: 'G1' });
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'console.log("verified")'] });
    assert.equal(result.code, 0, result.stderr);
    return result.json.revision;
  }

  function writeOutput(root, name, text = '🟢 no findings\n') {
    const dir = path.join(root, '.omj', 'goals', 'demo', 'reviews');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, name), text);
    return `reviews/${name}`;
  }

  it('rejects a malformed crossReview declaration and the removed required mode at init', () => {
    for (const crossReview of [true, {}, { authorHost: 'claude' }, { authorHost: 'Claude', mode: 'preferred' }, { authorHost: 'claude', mode: 'sometimes' }, { authorHost: 'claude', mode: 'required' }, { authorHost: 'claude', mode: 'preferred', extra: 1 }]) {
      const root = makeRepo();
      const result = run(root, 'init', { brief: '# Approved plan\n', goals: goals(false), crossReview });
      assert.notEqual(result.code, 0, JSON.stringify(crossReview));
      assert.match(result.stderr, /crossReview must be/);
    }
  });

  it('records a review from another host that left its own output file', () => {
    const root = makeRepo();
    assert.equal(crossInit(root).code, 0);
    const revision = verifiedGoal(root);
    const output = writeOutput(root, 'G1-pass1.out.md');

    let result = run(root, 'review', reviewInput(revision));
    assert.match(result.stderr, /cross-host review is preferred: record reviewerHost \(not claude\) with output/);
    result = run(root, 'review', reviewInput(revision, { reviewerHost: 'claude', output }));
    assert.match(result.stderr, /cross-host review is preferred/);
    result = run(root, 'review', reviewInput(revision, { reviewerHost: 'codex', output: 'evidence/x.json' }));
    assert.match(result.stderr, /under reviews\//);
    result = run(root, 'review', reviewInput(revision, { reviewerHost: 'codex', output: 'reviews/missing.out.md' }));
    assert.match(result.stderr, /missing or empty/);

    result = run(root, 'review', reviewInput(revision, { reviewerHost: 'codex', output }));
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'observed' }] });
    assert.equal(result.code, 0, result.stderr);

    const status = run(root, 'status');
    assert.deepEqual(status.json.crossReview, { authorHost: 'claude', mode: 'preferred' });
    assert.equal(status.json.reviews[0].reviewerHost, 'codex');
    assert.equal(status.json.reviews[0].output, output);
    assert.match(status.json.reviews[0].outputHash, /^[0-9a-f]{64}$/);
  });

  it('lets preferred mode continue on one host only with a recorded reason', () => {
    const root = makeRepo();
    assert.equal(crossInit(root).code, 0);
    const revision = verifiedGoal(root);

    let result = run(root, 'review', reviewInput(revision, { reviewer: 'critic' }));
    assert.match(result.stderr, /cross-host review is preferred/);
    result = run(root, 'review', reviewInput(revision, { reviewer: 'critic', fallbackReason: '   ' }));
    assert.match(result.stderr, /fallbackReason must be a non-empty string/);
    const output = writeOutput(root, 'G1-pass1.out.md');
    result = run(root, 'review', reviewInput(revision, { reviewerHost: 'codex', output, fallbackReason: 'not needed' }));
    assert.match(result.stderr, /cross-host review is preferred/, 'a cross-host review carries no fallback reason');

    result = run(root, 'review', reviewInput(revision, { reviewer: 'critic', fallbackReason: 'codex exec failed twice: usage limit reached' }));
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'observed' }] });
    assert.equal(result.code, 0, result.stderr);
    const review = run(root, 'status').json.reviews[0];
    assert.equal(review.fallbackReason, 'codex exec failed twice: usage limit reached');
    assert.equal(review.output, undefined);
  });

  it('judges the reviewer against the host that wrote the change when another host resumes', () => {
    const root = makeRepo();
    assert.equal(crossInit(root).code, 0);
    const revision = verifiedGoal(root);
    const output = writeOutput(root, 'G1-pass1.out.md');
    let result = run(root, 'review', reviewInput(revision, { reviewer: 'codex:critic', authorHost: 'codex', reviewerHost: 'codex', output }));
    assert.match(result.stderr, /record reviewerHost \(not codex\)/);
    result = run(root, 'review', reviewInput(revision, { reviewer: 'claude:critic', authorHost: 'codex', reviewerHost: 'claude', output }));
    assert.equal(result.code, 0, result.stderr);
    assert.equal(run(root, 'status').json.reviews[0].authorHost, 'codex');
  });

  it('detects a reviewer output edited after it was recorded', () => {
    const root = makeRepo();
    assert.equal(crossInit(root).code, 0);
    const revision = verifiedGoal(root);
    const output = writeOutput(root, 'G1-pass1.out.md');
    assert.equal(run(root, 'review', reviewInput(revision, { reviewerHost: 'codex', output })).code, 0);
    writeOutput(root, 'G1-pass1.out.md', '🟢 rewritten by the author\n');
    const status = run(root, 'status');
    assert.notEqual(status.code, 0);
    assert.match(status.stderr, /review output missing or tampered/);
  });

  it('binds the declaration to the plan hash', () => {
    const root = makeRepo();
    assert.equal(crossInit(root).code, 0);
    const ledger = path.join(root, '.omj', 'goals', 'demo', 'ledger.jsonl');
    const first = JSON.parse(readFileSync(ledger, 'utf8').split('\n')[0]);
    delete first.crossReview;
    writeFileSync(ledger, `${JSON.stringify(first)}\n`);
    const status = run(root, 'status');
    assert.notEqual(status.code, 0);
    assert.match(status.stderr, /approved plan hash mismatch/);
  });

  it('leaves a plan without the declaration unchanged and hashes an output when one is given', () => {
    const root = makeRepo();
    assert.equal(init(root, { second: false }).code, 0);
    const revision = verifiedGoal(root);
    let result = run(root, 'review', { expectedRevision: revision, scope: { goalId: 'G1' }, reviewer: 'critic', verdict: 'fail', summary: 'Blocking finding.' });
    assert.equal(result.code, 0, result.stderr);
    const output = writeOutput(root, 'G1-pass2.out.md');
    result = run(root, 'review', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, reviewer: 'critic', verdict: 'pass', summary: 'Fixed.', output });
    assert.equal(result.code, 0, result.stderr);
    const status = run(root, 'status');
    assert.equal(status.json.crossReview, undefined);
    assert.equal(status.json.reviews[0].output, undefined);
    assert.equal(status.json.reviews[1].output, output);
  });
});

describe('goal-state command runner', () => {
  it('kills the command group when the runner receives SIGTERM', { skip: process.platform === 'win32' }, async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'omj-runner-'));
    roots.push(dir);
    const pidFile = path.join(dir, 'pid');
    const spec = path.join(dir, 'spec.json');
    writeFileSync(spec, JSON.stringify({
      argv: [process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => {}, 20000)`],
      cwd: dir, timeoutMs: null, stdoutPath: path.join(dir, 'out'), stderrPath: path.join(dir, 'err'), resultPath: path.join(dir, 'result.json'),
    }));
    const runner = spawn(process.execPath, [SCRIPT, '__run', spec], { stdio: 'ignore' });
    let pid = null;
    for (let attempt = 0; attempt < 200 && !pid; attempt += 1) {
      await sleep(25);
      if (existsSync(pidFile)) pid = Number(readFileSync(pidFile, 'utf8')) || null;
    }
    assert.ok(pid, 'the command started');
    runner.kill('SIGTERM');
    assert.ok(await waitGone(pid, 2000), 'the command group ends with the runner');
  });
});

function v15(root, verb, input) {
  const result = run(root, verb, input, 'demo', V15_SCRIPT);
  assert.equal(result.code, 0, `${verb}: ${result.stderr}`);
  return result.json;
}

const removedFeature = /goal-state: this ledger uses (.+), removed in 2\.0 — finish it with oh-my-joy 1\.5\.x/;
const prContract = (root, findings = []) => ({ host: 'github.com', repo: 'acme/widget', number: 42, headSha: git(root, 'rev-parse', 'HEAD'), deliveryRequired: false, findings });
const experimentGoal = {
  id: 'E1', title: 'Lower cost', objective: 'Lower the cost metric', kind: 'experiment', acceptance: ['best cost is recorded'],
  experiment: {
    metric: { name: 'cost', direction: 'lower', deterministic: true },
    evaluator: { argv: ['node', 'bench.mjs'], repeats: 1 },
    guards: [{ argv: ['node', '-e', 'process.exit(0)'] }],
    scope: ['src/'],
    sealed: ['bench.mjs'],
    maxTrials: 2,
  },
};

describe('goal-state 2.0 removals', () => {
  it('reports a missing ledger as absent instead of failing', () => {
    const root = makeRepo();
    const result = run(root, 'status');
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.json, { exists: false, slug: 'demo' });
    const started = run(root, 'start', { expectedRevision: 1, goalId: 'G1' });
    assert.equal(started.code, 1);
    assert.match(started.stderr, /ledger\.jsonl not found/);
    mkdirSync(path.join(root, '.omj/goals/demo'), { recursive: true });
    const emptyDir = run(root, 'status');
    assert.equal(emptyDir.code, 0, emptyDir.stderr);
    assert.deepEqual(emptyDir.json, { exists: false, slug: 'demo' }, 'a slug directory without ledger.jsonl has no ledger');
  });

  it('treats trial, finding, and delivery as unknown verbs', () => {
    const root = makeRepo();
    assert.equal(init(root, { second: false }).code, 0);
    for (const verb of ['trial', 'finding', 'delivery']) {
      const result = run(root, verb, { expectedRevision: 1, goalId: 'G1', id: 'F1' });
      assert.equal(result.code, 1);
      assert.match(result.stderr, new RegExp(`unknown verb: ${verb}`));
    }
    assert.equal(run(root, 'status').json.revision, 1);
  });

  it('refuses to start a ledger with an experiment goal, a PR contract, or required cross-host review', () => {
    const root = makeRepo();
    const cases = [
      [{ goals: [experimentGoal] }, /kind must be change or report/],
      [{ goals: goals(false), pr: prContract(root) }, /pr was removed in 2\.0/],
      [{ goals: goals(false), crossReview: { authorHost: 'claude', mode: 'required' } }, /crossReview must be/],
    ];
    for (const [input, pattern] of cases) {
      const result = run(root, 'init', { brief: '# Approved plan\n', ...input });
      assert.equal(result.code, 1, JSON.stringify(input));
      assert.match(result.stderr, pattern);
      assert.equal(existsSync(path.join(root, '.omj/goals/demo')), false);
    }
  });

  it('stops every verb on a 1.5 ledger that used a removed feature', () => {
    const ledgers = [
      ['experiment goals', (root) => v15(root, 'init', { brief: '# Approved plan\n', goals: [experimentGoal] })],
      ['a PR contract', (root) => v15(root, 'init', { brief: '# Approved plan\n', goals: goals(false), pr: prContract(root) })],
      ['crossReview mode required', (root) => v15(root, 'init', { brief: '# Approved plan\n', goals: goals(false), crossReview: { authorHost: 'claude', mode: 'required' } })],
      ['a PR contract', (root) => {
        const created = v15(root, 'init', { brief: '# Approved plan\n', goals: goals(false), pr: prContract(root, [{ id: 'F1', title: 'Bug' }]) });
        v15(root, 'finding', { expectedRevision: created.revision, id: 'F1', disposition: 'rejected', rationale: 'Intended.' });
        assert.ok(readFileSync(path.join(root, '.omj/goals/demo/ledger.jsonl'), 'utf8').includes('"finding_dispositioned"'));
      }],
    ];
    for (const [feature, make] of ledgers) {
      const root = makeRepo();
      make(root);
      for (const [verb, input] of [['status'], ['init', { brief: '# Approved plan\n', goals: goals(false) }], ['reconcile', { expectedRevision: 1 }], ['start', { expectedRevision: 1, goalId: 'G1' }], ['close', { expectedRevision: 1 }]]) {
        const result = run(root, verb, input);
        assert.notEqual(result.code, 0, `${feature} / ${verb} must stop`);
        assert.equal(result.stderr.match(removedFeature)?.[1], feature, `${verb}: ${result.stderr}`);
      }
    }
  });

  it('names the removed feature before checking the plan hash or a later event', () => {
    const root = makeRepo();
    v15(root, 'init', { brief: '# Approved plan\n', goals: [experimentGoal] });
    writeFileSync(path.join(root, '.omj/goals/demo/brief.md'), '# Replaced plan\n');
    assert.equal(run(root, 'status').stderr.match(removedFeature)?.[1], 'experiment goals');

    const plain = makeRepo();
    v15(plain, 'init', { brief: '# Approved plan\n', goals: goals(false) });
    const ledger = path.join(plain, '.omj/goals/demo/ledger.jsonl');
    for (const [type, feature] of [['trial_recorded', 'trial events'], ['finding_dispositioned', 'finding events'], ['delivery_recorded', 'delivery events']]) {
      const [first] = readFileSync(ledger, 'utf8').split('\n');
      writeFileSync(ledger, `${first}\n${JSON.stringify({ seq: 2, ts: new Date().toISOString(), type })}\n`);
      assert.equal(run(plain, 'status').stderr.match(removedFeature)?.[1], feature);
    }
  });

  it('reads and closes a plain 1.5 ledger with change and report goals', () => {
    const root = makeRepo();
    const mixed = [goals(false)[0], { id: 'R1', title: 'Audit', objective: 'Report findings', kind: 'report', acceptance: ['sources are named'] }];
    let json = v15(root, 'init', { brief: '# Approved plan\n', goals: mixed });
    json = v15(root, 'start', { expectedRevision: json.revision, goalId: 'G1' });
    json = v15(root, 'verify', { expectedRevision: json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'process.exit(0)'] });
    json = v15(root, 'review', { expectedRevision: json.revision, scope: { goalId: 'G1' }, reviewer: 'reviewer-1', verdict: 'fail', summary: 'Blocking finding.' });
    json = v15(root, 'review', { expectedRevision: json.revision, scope: { goalId: 'G1' }, reviewer: 'reviewer-2', verdict: 'pass', summary: 'Fixed.' });
    json = v15(root, 'complete', { expectedRevision: json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'verified' }] });
    json = v15(root, 'start', { expectedRevision: json.revision, goalId: 'R1' });
    json = v15(root, 'evidence', { expectedRevision: json.revision, scope: { goalId: 'R1' }, summary: 'Inspected app.txt.', acceptance: ['Named app.txt as the source.'] });
    json = v15(root, 'review', { expectedRevision: json.revision, scope: { goalId: 'R1' }, reviewer: 'reviewer-3', verdict: 'pass', summary: 'Report is supported.' });
    v15(root, 'complete', { expectedRevision: json.revision, goalId: 'R1', acceptanceEvidence: [{ criterion: 'sources are named', evidence: 'app.txt is cited' }] });

    const status = run(root, 'status');
    assert.equal(status.code, 0, status.stderr);
    assert.equal(status.json.snapshotStatus, 'ok', 'the 2.0 state matches the snapshot the 1.5 helper wrote');
    assert.deepEqual(status.json.goals.map((goal) => goal.status), ['complete', 'complete']);
    assert.match(run(root, 'init', { brief: '# Approved plan\n', goals: goals(false) }).stderr, /\.omj\/goals\/demo\/ already exists/);
    let result = run(root, 'verify', { expectedRevision: status.json.revision, scope: 'final', argv: ['node', '-e', 'process.exit(0)'] });
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'review', { expectedRevision: result.json.revision, scope: 'final', reviewer: 'final-reviewer', verdict: 'pass', summary: 'Final diff passes review.' });
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'close', { expectedRevision: result.json.revision });
    assert.equal(result.code, 0, result.stderr);
    const after = run(root, 'status', undefined, 'demo', V15_SCRIPT);
    assert.equal(after.json.closed, true);
    assert.equal(after.json.snapshotStatus, 'ok', 'the 1.5 helper reads the snapshot the 2.0 helper wrote as unchanged');
  });
});

describe('goal-state review cap', () => {
  const review = (root, revision, scope, verdict) => run(root, 'review', { expectedRevision: revision, scope, reviewer: 'critic-agent', verdict, summary: `${verdict} review` });
  function failTimes(root, revision, scope, times) {
    for (let pass = 0; pass < times; pass += 1) {
      const result = review(root, revision, scope, 'fail');
      assert.equal(result.code, 0, result.stderr);
      revision = result.json.revision;
    }
    return revision;
  }
  function refused(root, revision, scope, pattern) {
    for (const verdict of ['fail', 'pass']) {
      const result = review(root, revision, scope, verdict);
      assert.equal(result.code, 1, `${verdict} review after three failures`);
      assert.match(result.stderr, pattern);
    }
    assert.equal(run(root, 'status').json.revision, revision, 'a refused review appends nothing');
  }

  it('refuses a fourth goal review after three failures until the goal is blocked and resumed', () => {
    const root = makeRepo();
    let result = run(root, 'start', { expectedRevision: init(root, { second: false }).json.revision, goalId: 'G1' });
    result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'process.exit(0)'] });
    const revision = failTimes(root, result.json.revision, { goalId: 'G1' }, 3);
    refused(root, revision, { goalId: 'G1' }, /review has failed three times — block the goal/);
    result = run(root, 'block', { expectedRevision: revision, goalId: 'G1', reason: 'review not converging' });
    result = run(root, 'resume', { expectedRevision: result.json.revision, goalId: 'G1' });
    assert.equal(result.code, 0, result.stderr);
    result = review(root, result.json.revision, { goalId: 'G1' }, 'fail');
    assert.equal(result.code, 0, result.stderr);
    result = review(root, result.json.revision, { goalId: 'G1' }, 'pass');
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'complete', { expectedRevision: result.json.revision, goalId: 'G1', acceptanceEvidence: [{ criterion: 'first behavior works', evidence: 'verified' }] });
    assert.equal(result.code, 0, result.stderr);
  });

  it('refuses a fourth final review after three failures until resume reopens the final audit', () => {
    const root = makeRepo();
    let revision = passGoal(root, init(root, { second: false }).json.revision, 'G1');
    revision = run(root, 'verify', { expectedRevision: revision, scope: 'final', argv: ['node', '-e', 'process.exit(0)'] }).json.revision;
    revision = failTimes(root, revision, 'final', 2);
    let result = run(root, 'resume', { expectedRevision: revision, scope: 'final' });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /three failed final reviews/);
    revision = failTimes(root, revision, 'final', 1);
    refused(root, revision, 'final', /review has failed three times — stop and report with the ledger open/);
    result = run(root, 'resume', { expectedRevision: revision, scope: 'final' });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.json, { scope: 'final', revision: revision + 1 });
    const status = run(root, 'status');
    assert.equal(status.code, 0, status.stderr);
    assert.equal(status.json.revision, revision + 1);
    result = review(root, status.json.revision, 'final', 'pass');
    assert.equal(result.code, 0, result.stderr);
    result = run(root, 'close', { expectedRevision: result.json.revision });
    assert.equal(result.code, 0, result.stderr);
  });

  it('refuses a final resume while a goal is open and rejects a forged final_resumed event', () => {
    const root = makeRepo();
    const created = init(root, { second: false });
    const result = run(root, 'resume', { expectedRevision: created.json.revision, scope: 'final' });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /final resume requires every goal complete/);
    appendFileSync(path.join(root, '.omj/goals/demo/ledger.jsonl'), `${JSON.stringify({ seq: 2, ts: new Date().toISOString(), type: 'final_resumed' })}\n`);
    const status = run(root, 'status');
    assert.equal(status.code, 1);
    assert.match(status.stderr, /illegal final_resumed/);
  });

  it('keeps a 1.5 ledger with more than three failed reviews readable and caps it from now on', () => {
    const root = makeRepo();
    let json = v15(root, 'init', { brief: '# Approved plan\n', goals: goals(false) });
    json = v15(root, 'start', { expectedRevision: json.revision, goalId: 'G1' });
    json = v15(root, 'verify', { expectedRevision: json.revision, scope: { goalId: 'G1' }, argv: ['node', '-e', 'process.exit(0)'] });
    for (let pass = 0; pass < 4; pass += 1) json = v15(root, 'review', { expectedRevision: json.revision, scope: { goalId: 'G1' }, reviewer: 'critic-agent', verdict: 'fail', summary: 'fail review' });
    const status = run(root, 'status');
    assert.equal(status.code, 0, status.stderr);
    assert.equal(status.json.reviews.length, 4);
    refused(root, status.json.revision, { goalId: 'G1' }, /review has failed three times — block the goal/);
  });
});
