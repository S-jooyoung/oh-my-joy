import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';

import { repoPath } from './helpers/repo.mjs';

const SCRIPT = repoPath('scripts', 'goal-state.mjs');
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

function run(root, verb, input, slug = 'demo') {
  const result = spawnSync('node', [SCRIPT, verb, '--slug', slug], {
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

function passGoal(root, revision, goalId) {
  let result = run(root, 'start', { expectedRevision: revision, goalId });
  assert.equal(result.code, 0, result.stderr);
  result = run(root, 'verify', { expectedRevision: result.json.revision, scope: { goalId }, argv: ['node', '-e', 'console.log("verified")'] });
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
    assert.equal(snapshot.schemaVersion, 2);
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
