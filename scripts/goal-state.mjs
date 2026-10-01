#!/usr/bin/env node
/** Durable, provider-neutral state and evidence helper for OMJ ultragoal. */
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { hostname, tmpdir, uptime } from 'node:os';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SCHEMA_VERSION = 3;
const SUPPORTED_SCHEMA_VERSIONS = new Set([2, 3]);
export const GOAL_STATUSES = ['pending', 'active', 'complete', 'blocked'];
const GOAL_KINDS = ['change', 'report', 'experiment'];
const EVENT_TYPES = new Set([
  'initialized', 'goal_started', 'goal_resumed', 'goal_blocked', 'proof_recorded',
  'review_recorded', 'finding_dispositioned', 'delivery_recorded', 'goal_completed', 'plan_closed',
  'trial_recorded',
]);
const TRIAL_DECISIONS = new Set(['baseline', 'keep', 'discard', 'guard_failed', 'crash', 'invalid', 'repair']);
const SELF = fileURLToPath(import.meta.url);
const VERIFY_TAIL = 1_000_000;
const TRIAL_TAIL = 20_000;
const SNAPSHOT_LIMIT = 2 * 1024 * 1024;
const CANDIDATE_LIMIT = 256 * 1024;
const BASELINE_ATTEMPTS = 3;

const fail = (message) => {
  process.stderr.write(`goal-state: ${message}\n`);
  process.exitCode = 1;
  const error = new Error('__goal_state_failure__');
  error.detail = message;
  throw error;
};
const ok = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

let cachedRepoRoot;
function projectRoot() {
  if (!cachedRepoRoot) {
    const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), encoding: 'utf8' });
    if (result.status !== 0) fail(`not inside a git worktree: ${(result.stderr || '').trim()}`);
    cachedRepoRoot = result.stdout.trim();
  }
  return cachedRepoRoot;
}

const rootFor = (slug) => path.join(projectRoot(), '.omj', 'goals', slug);
const ledgerFor = (slug) => path.join(rootFor(slug), 'ledger.jsonl');
const snapshotFor = (slug) => path.join(rootFor(slug), 'goals.json');
const evidenceFor = (slug) => path.join(rootFor(slug), 'evidence');
const lockFor = (slug) => `${rootFor(slug)}.lock`;
const markerFor = (slug) => path.join(rootFor(slug), 'trial.pending.json');

function requireSlug(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    fail('--slug allows lowercase letters, digits, and hyphens only');
  }
  return value;
}

function git(args, { allowFailure = false, cwd = projectRoot() } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 && !allowFailure) fail(`git ${args.join(' ')} failed: ${(result.stderr || '').trim()}`);
  return result;
}

function gitBuffer(args) {
  const result = spawnSync('git', args, { cwd: projectRoot(), maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) fail(`git ${args.join(' ')} failed: ${(result.stderr || '').toString().trim()}`);
  return result.stdout;
}

export function workspaceFingerprint() {
  const top = projectRoot();
  const headResult = git(['rev-parse', 'HEAD'], { allowFailure: true });
  const headSha = headResult.status === 0 ? headResult.stdout.trim() : null;
  const stateExcluded = ['--', ':(top)**', ':(top,exclude).omj/goals/**'];
  const diff = headSha ? git(['diff', '--binary', 'HEAD', ...stateExcluded]).stdout : '';
  const staged = git(['diff', '--cached', '--binary', ...stateExcluded]).stdout;
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).stdout
    .split('\0')
    .filter((file) => file && !file.startsWith('.omj/goals/'))
    .sort();
  const untrackedHashes = untracked.map((file) => {
    const absolute = path.join(top, file);
    const stat = lstatSync(absolute);
    return `${file}\0${stat.isSymbolicLink() ? `symlink:${readlinkSync(absolute)}` : sha256(readFileSync(absolute))}`;
  }).join('\n');
  return {
    sha256: sha256(`${headSha ?? 'UNBORN'}\0${diff}\0${staged}\0${untrackedHashes}`),
    headSha,
    dirty: Boolean(diff || staged || untracked.length),
  };
}

function repoIdentity() {
  const repoRoot = projectRoot();
  return {
    repoRoot,
    gitCommonDir: path.resolve(repoRoot, git(['rev-parse', '--git-common-dir']).stdout.trim()),
    worktreeRoot: repoRoot,
  };
}

function readInput(required = true) {
  const raw = readFileSync(0, 'utf8');
  if (!raw.trim()) {
    if (required) fail('JSON stdin object is required');
    return {};
  }
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value !== 'object') fail('JSON stdin must be an object');
    return value;
  } catch (error) {
    if (error.message === '__goal_state_failure__') throw error;
    fail(`JSON stdin parse failure: ${error.message}`);
  }
}

function readLedger(slug) {
  if (!existsSync(ledgerFor(slug))) fail(`.omj/goals/${slug}/ledger.jsonl not found — run init first`);
  const raw = readFileSync(ledgerFor(slug), 'utf8');
  if (raw && !raw.endsWith('\n')) fail('ledger is truncated — final event has no newline');
  return raw.split('\n').filter(Boolean).map((line, index) => {
    let event;
    try { event = JSON.parse(line); } catch { fail(`ledger line ${index + 1} is corrupt JSON`); }
    if (event.seq !== index + 1) fail(`ledger seq mismatch at line ${index + 1}`);
    if (!EVENT_TYPES.has(event.type)) fail(`ledger line ${index + 1} has unknown event type`);
    return event;
  });
}

function initialState(event) {
  const state = {
    schemaVersion: event.schemaVersion,
    slug: event.slug,
    revision: 1,
    closed: false,
    createdAt: event.ts,
    updatedAt: event.ts,
    planHash: event.planHash,
    identity: event.identity,
    initialFingerprint: event.initialFingerprint,
    goals: event.goals.map((goal) => ({ ...goal, status: 'pending', completion: null, blockedReason: null })),
    proofs: [],
    reviews: [],
    pr: event.pr ?? null,
    findings: Object.fromEntries((event.pr?.findings ?? []).map((finding) => [finding.id, { ...finding, disposition: null }])),
    delivery: null,
  };
  const experimentGoals = event.goals.filter((goal) => goal.kind === 'experiment');
  if (experimentGoals.length) {
    state.experiments = Object.fromEntries(experimentGoals.map((goal) => [goal.id, {
      startScopeHash: null,
      baselineHead: null,
      baseline: null,
      best: null,
      sealedBaseline: null,
      outsideBaseline: null,
      trials: [],
      normalTrials: 0,
      nonKeepStreak: 0,
      baselineFailures: 0,
      stopReason: null,
    }]));
  }
  return state;
}

const proofKindFor = (goal) => (goal.kind === 'report' ? 'report' : 'command');
const finalProofKind = (state) => (state.goals.some((goal) => goal.kind !== 'report') ? 'command' : 'report');
const meetsTarget = (config, value) => (config.metric.direction === 'lower' ? value <= config.target : value >= config.target);

function stopReasonFor(config, exp) {
  if (!exp.baseline) return exp.baselineFailures >= BASELINE_ATTEMPTS ? 'no_baseline' : null;
  if (config.target !== undefined && meetsTarget(config, exp.best.value)) return 'target';
  if (exp.normalTrials >= config.maxTrials) return 'max_trials';
  if (config.patience !== undefined && exp.nonKeepStreak >= config.patience) return 'plateau';
  return null;
}

function validSnapshotReceipt(snapshot) {
  return Boolean(snapshot?.artifact && snapshot?.artifactHash && typeof snapshot.scopeHash === 'string');
}

function applyTrial(state, goal, event) {
  const where = `trial_recorded at seq ${event.seq}`;
  if (state.schemaVersion < 3 || !goal || goal.kind !== 'experiment' || goal.status !== 'active') fail(`illegal ${where}`);
  const exp = state.experiments[goal.id];
  const config = goal.experiment;
  const trial = event.trial;
  if (!trial || trial.n !== exp.trials.length || !TRIAL_DECISIONS.has(trial.decision) || typeof trial.hypothesis !== 'string'
    || !trial.artifact || !trial.artifactHash || typeof trial.fingerprint !== 'string' || !Array.isArray(trial.values)
    || trial.values.some((value) => !Number.isFinite(value))) fail(`invalid ${where}`);
  const repair = trial.repair === true;
  const interrupted = trial.reason === 'interrupted';
  if (interrupted && trial.decision !== 'crash') fail(`invalid ${where}`);
  if (['baseline', 'keep', 'repair'].includes(trial.decision) && (!validSnapshotReceipt(trial.snapshot) || !Number.isFinite(trial.value))) fail(`invalid ${where}`);
  if (!repair && exp.stopReason) fail(`${where} follows stop reason ${exp.stopReason}`);
  if (!exp.baseline) {
    if (repair || !['baseline', 'crash', 'invalid'].includes(trial.decision)) fail(`illegal ${where} before a baseline`);
    if (trial.decision === 'baseline') {
      const integrity = trial.integrity;
      if (!integrity || typeof integrity.head !== 'string' || !integrity.sealed || !integrity.outside || !Number.isFinite(trial.spread)) fail(`invalid ${where}`);
      exp.baseline = { value: trial.value, spread: trial.spread, n: trial.n, snapshot: trial.snapshot };
      exp.best = { value: trial.value, n: trial.n, fingerprint: trial.fingerprint, snapshot: trial.snapshot };
      exp.sealedBaseline = integrity.sealed;
      exp.outsideBaseline = integrity.outside;
      exp.baselineHead = integrity.head;
    } else if (!interrupted) {
      exp.baselineFailures += 1;
    }
  } else if (repair) {
    if (!['repair', 'guard_failed', 'crash', 'invalid'].includes(trial.decision)) fail(`illegal ${where} for a repair`);
    if (latestReview(state, goal.id, exp.best.fingerprint)?.verdict !== 'fail') fail(`${where} repairs without a failing review at the best state`);
    if (trial.decision === 'repair') exp.best = { value: trial.value, n: trial.n, fingerprint: trial.fingerprint, snapshot: trial.snapshot };
  } else {
    if (!['keep', 'discard', 'guard_failed', 'crash', 'invalid'].includes(trial.decision)) fail(`illegal ${where}`);
    if (!interrupted) {
      exp.normalTrials += 1;
      if (trial.decision === 'keep') {
        exp.nonKeepStreak = 0;
        exp.best = { value: trial.value, n: trial.n, fingerprint: trial.fingerprint, snapshot: trial.snapshot };
      } else {
        exp.nonKeepStreak += 1;
      }
    }
  }
  exp.trials.push({
    n: trial.n,
    hypothesis: trial.hypothesis,
    repair,
    decision: trial.decision,
    value: Number.isFinite(trial.value) ? trial.value : null,
    reason: trial.reason ?? null,
    restored: typeof trial.restored === 'boolean' ? trial.restored : null,
    artifact: trial.artifact,
    artifactHash: trial.artifactHash,
    snapshot: trial.snapshot ?? null,
  });
  exp.stopReason = stopReasonFor(config, exp);
}

function checkExperimentCompletion(state, goal, completion, seq) {
  const exp = state.experiments?.[goal.id];
  const record = completion.experiment;
  const where = `goal_completed at seq ${seq}`;
  if (!exp?.baseline || !exp.best || !record) fail(`${where} lacks experiment evidence`);
  if (exp.normalTrials < 1 && exp.stopReason !== 'target') fail(`${where} has no trial after the baseline`);
  if (completion.fingerprint !== exp.best.fingerprint || record.bestTrial !== exp.best.n || record.bestValue !== exp.best.value) fail(`${where} is not at the best measured state`);
  if (canonical(record.sealed) !== canonical(exp.sealedBaseline)) fail(`${where} has sealed files that differ from the baseline`);
  if (goal.experiment.target !== undefined && !meetsTarget(goal.experiment, exp.best.value)) fail(`${where} misses the approved target`);
}

function finalReviewSatisfied(state, event) {
  const finalReview = latestReview(state, 'final', event.fingerprint);
  if (event.finalReview?.reused) {
    if (state.schemaVersion < 3 || finalReview || state.goals.length !== 1) return false;
    const [goal] = state.goals;
    return goal.completion?.fingerprint === event.fingerprint && goal.completion.reviewArtifact === event.finalReview.artifact;
  }
  return finalReview?.verdict === 'pass';
}

export function deriveState(events) {
  if (events.length === 0 || events[0].type !== 'initialized') fail('ledger must begin with initialized');
  if (!SUPPORTED_SCHEMA_VERSIONS.has(events[0].schemaVersion)) fail(`unsupported ledger schema version: ${events[0].schemaVersion}`);
  const state = initialState(events[0]);
  for (const event of events.slice(1)) {
    if (state.closed) fail(`ledger event ${event.seq} appears after plan_closed`);
    if (event.type === 'initialized') fail('ledger contains a second initialized event');
    state.revision = event.seq;
    state.updatedAt = event.ts;
    const goal = event.goalId ? state.goals.find((item) => item.id === event.goalId) : null;
    if (event.goalId && !goal) fail(`ledger event ${event.seq} names unknown goal ${event.goalId}`);
    if (event.type === 'goal_started') {
      if (goal.status !== 'pending' || state.goals.some((item) => item.status === 'active')) fail(`illegal goal_started event at seq ${event.seq}`);
      goal.status = 'active';
      goal.blockedReason = null;
      if (goal.kind === 'experiment') {
        if (typeof event.startScopeHash !== 'string') fail(`goal_started at seq ${event.seq} lacks the experiment scope hash`);
        state.experiments[goal.id].startScopeHash = event.startScopeHash;
      }
    } else if (event.type === 'goal_resumed') {
      if (goal.status !== 'blocked' || state.goals.some((item) => item.status === 'active')) fail(`illegal goal_resumed event at seq ${event.seq}`);
      goal.status = 'active';
      goal.blockedReason = null;
      if (goal.kind === 'experiment' && !state.experiments[goal.id].baseline) {
        if (typeof event.startScopeHash !== 'string') fail(`goal_resumed at seq ${event.seq} lacks the experiment scope hash`);
        state.experiments[goal.id].startScopeHash = event.startScopeHash;
      }
    } else if (event.type === 'goal_blocked') {
      if (goal.status !== 'active' || typeof event.reason !== 'string' || !event.reason.trim()) fail(`illegal goal_blocked event at seq ${event.seq}`);
      goal.status = 'blocked';
      goal.blockedReason = event.reason;
    } else if (event.type === 'proof_recorded') {
      const proof = event.proof;
      if (!proof || !['command', 'report'].includes(proof.kind) || !proof.artifact || !proof.artifactHash || !proof.fingerprint) fail(`invalid proof_recorded event at seq ${event.seq}`);
      if (proof.scope !== 'final' && !state.goals.some((item) => item.id === proof.scope)) fail(`proof at seq ${event.seq} has unknown scope`);
      if (proof.scope === 'final' ? state.goals.some((item) => item.status !== 'complete') : state.goals.find((item) => item.id === proof.scope).status !== 'active') fail(`proof at seq ${event.seq} is out of sequence`);
      if (proof.kind === 'command' && (!Array.isArray(proof.argv) || !Number.isInteger(proof.exitCode) || typeof proof.stable !== 'boolean')) fail(`invalid command proof at seq ${event.seq}`);
      state.proofs.push(proof);
    } else if (event.type === 'review_recorded') {
      const review = event.review;
      if (!review || !review.artifact || !review.artifactHash || !review.fingerprint || !review.reviewer || !['pass', 'fail'].includes(review.verdict)) fail(`invalid review_recorded event at seq ${event.seq}`);
      if (review.scope !== 'final' && !state.goals.some((item) => item.id === review.scope)) fail(`review at seq ${event.seq} has unknown scope`);
      if (review.scope === 'final' ? state.goals.some((item) => item.status !== 'complete') : state.goals.find((item) => item.id === review.scope).status !== 'active') fail(`review at seq ${event.seq} is out of sequence`);
      state.reviews.push(review);
    } else if (event.type === 'trial_recorded') {
      applyTrial(state, goal, event);
    } else if (event.type === 'finding_dispositioned') {
      if (!state.pr || !event.finding || !state.findings[event.finding.id] || !['accepted', 'rejected'].includes(event.finding.disposition) || !event.finding.rationale) fail(`invalid finding_dispositioned event at seq ${event.seq}`);
      state.findings[event.finding.id] = event.finding;
    } else if (event.type === 'delivery_recorded') {
      if (!state.pr || !event.delivery?.fingerprint || !event.delivery?.headSha || !Array.isArray(event.delivery.replies)) fail(`invalid delivery_recorded event at seq ${event.seq}`);
      state.delivery = event.delivery;
    } else if (event.type === 'goal_completed') {
      if (goal.status !== 'active' || !event.completion) fail(`illegal goal_completed event at seq ${event.seq}`);
      const proof = eligibleProof(state, goal.id, event.completion.fingerprint, proofKindFor(goal));
      const review = latestReview(state, goal.id, event.completion.fingerprint);
      if (!proof || review?.verdict !== 'pass' || proof.artifact !== event.completion.proofArtifact || review.artifact !== event.completion.reviewArtifact) fail(`goal_completed at seq ${event.seq} lacks matching proof/review`);
      if (!validAcceptanceEvidence(goal, event.completion.acceptanceEvidence)) fail(`goal_completed at seq ${event.seq} lacks acceptance evidence`);
      if (goal.kind === 'experiment') checkExperimentCompletion(state, goal, event.completion, event.seq);
      goal.status = 'complete';
      goal.completion = event.completion;
    } else if (event.type === 'plan_closed') {
      if (state.goals.some((item) => item.status !== 'complete')) fail(`plan_closed at seq ${event.seq} has incomplete goals`);
      const finalProof = eligibleProof(state, 'final', event.fingerprint, finalProofKind(state));
      if (!finalProof || !finalReviewSatisfied(state, event)) fail(`plan_closed at seq ${event.seq} lacks final proof/review`);
      for (const item of state.goals.filter((entry) => entry.kind === 'experiment')) {
        const exp = state.experiments[item.id];
        const recorded = event.experiments?.[item.id];
        if (!recorded || recorded.scope !== exp.best.snapshot.scopeHash || recorded.sealed !== sha256(canonical(exp.sealedBaseline))) fail(`plan_closed at seq ${event.seq} lacks the experiment close gate for ${item.id}`);
      }
      if (state.pr) {
        const findings = Object.values(state.findings);
        if (findings.some((finding) => !finding.disposition)) fail(`plan_closed at seq ${event.seq} has undispositioned findings`);
        if (state.pr.deliveryRequired) {
          const replied = new Set(state.delivery?.replies?.map((reply) => reply.findingId) ?? []);
          if (!state.delivery || state.delivery.fingerprint !== event.fingerprint || state.delivery.headSha !== finalProof.headSha || findings.some((finding) => !replied.has(finding.id))) fail(`plan_closed at seq ${event.seq} lacks current delivery receipts`);
        }
      }
      state.closed = true;
    }
  }
  return state;
}

function writeSnapshot(slug, state, dir = rootFor(slug)) {
  const target = path.join(dir, 'goals.json');
  const temp = `${target}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temp, target);
}

function trialReceipts(state) {
  return Object.values(state.experiments ?? {}).flatMap((exp) => exp.trials.flatMap((trial) => [trial, ...(trial.snapshot ? [trial.snapshot] : [])]));
}

function load(slug, { tolerateSnapshot = false } = {}) {
  const events = readLedger(slug);
  const state = deriveState(events);
  const brief = readFileSync(path.join(rootFor(slug), 'brief.md'), 'utf8');
  const expectedPlanHash = sha256(canonical({ brief, goals: events[0].goals, pr: events[0].pr ?? null }));
  if (state.planHash !== expectedPlanHash) fail('approved plan hash mismatch — brief or initialization ledger was modified');
  if (canonical(state.identity) !== canonical(repoIdentity())) fail('repository/worktree identity does not match the initialized plan');
  for (const receipt of [...state.proofs, ...state.reviews, ...trialReceipts(state)]) validateArtifact(slug, receipt);
  let snapshotStatus = 'ok';
  if (existsSync(snapshotFor(slug))) {
    try {
      const snapshot = JSON.parse(readFileSync(snapshotFor(slug), 'utf8'));
      if (snapshot.revision > events.length) fail('ledger is truncated behind the snapshot');
      if (canonical(snapshot) !== canonical(state)) {
        snapshotStatus = 'mismatch';
        if (!tolerateSnapshot) fail('snapshot disagrees with ledger — run reconcile');
      }
    } catch (error) {
      if (error.message === '__goal_state_failure__') throw error;
      snapshotStatus = 'corrupt';
      if (!tolerateSnapshot) fail('snapshot is corrupt — run reconcile');
    }
  } else {
    snapshotStatus = 'missing';
    if (!tolerateSnapshot) fail('snapshot is missing — run reconcile');
  }
  return { events, state, snapshotStatus };
}

function withLock(slug, operation) {
  mkdirSync(path.dirname(rootFor(slug)), { recursive: true });
  const owner = { pid: process.pid, host: hostname(), token: randomUUID(), createdAt: new Date().toISOString() };
  const temp = `${lockFor(slug)}.claim-${process.pid}-${owner.token}`;
  const recovery = `${lockFor(slug)}.recovery`;
  const acquire = () => {
    mkdirSync(temp);
    writeFileSync(path.join(temp, 'owner.json'), `${JSON.stringify(owner)}\n`);
    try {
      renameSync(temp, lockFor(slug));
      return;
    } catch {
      rmSync(temp, { recursive: true, force: true });
    }
    let existing;
    try { existing = JSON.parse(readFileSync(path.join(lockFor(slug), 'owner.json'), 'utf8')); } catch { fail(`writer lock for ${slug} has unverifiable ownership`); }
    if (existing.host !== hostname() || !Number.isInteger(existing.pid)) fail(`writer lock is held for ${slug}`);
    try { process.kill(existing.pid, 0); } catch (error) {
      if (error.code === 'ESRCH') {
        try { mkdirSync(recovery); } catch { fail(`writer lock recovery is already in progress for ${slug}`); }
        try {
          let current;
          try { current = JSON.parse(readFileSync(path.join(lockFor(slug), 'owner.json'), 'utf8')); } catch { fail(`writer lock for ${slug} changed during recovery`); }
          if (current.token !== existing.token || current.host !== existing.host || current.pid !== existing.pid) fail(`writer lock for ${slug} changed during recovery`);
          try { process.kill(current.pid, 0); fail(`writer lock is held for ${slug}`); } catch (retryError) {
            if (retryError.message === '__goal_state_failure__') throw retryError;
            if (retryError.code !== 'ESRCH') fail(`writer lock owner for ${slug} cannot be verified dead`);
          }
          rmSync(lockFor(slug), { recursive: true, force: true });
          mkdirSync(temp);
          writeFileSync(path.join(temp, 'owner.json'), `${JSON.stringify(owner)}\n`);
          try { renameSync(temp, lockFor(slug)); return; } catch { rmSync(temp, { recursive: true, force: true }); }
        } finally {
          rmSync(recovery, { recursive: true, force: true });
        }
      }
    }
    fail(`writer lock is held for ${slug}`);
  };
  acquire();
  try { return operation(); } finally {
    let heldByUs = false;
    try { heldByUs = JSON.parse(readFileSync(path.join(lockFor(slug), 'owner.json'), 'utf8')).token === owner.token; } catch {}
    if (heldByUs) rmSync(lockFor(slug), { recursive: true, force: true });
  }
}

function requireRevision(input, state) {
  if (!Number.isInteger(input.expectedRevision)) fail('expectedRevision integer is required');
  if (input.expectedRevision !== state.revision) {
    fail(`revision conflict: expected ${input.expectedRevision}, current ${state.revision}`);
  }
}

function append(slug, state, event) {
  const entry = { seq: state.revision + 1, ts: new Date().toISOString(), ...event };
  const next = deriveState([...readLedger(slug), entry]);
  appendFileSync(ledgerFor(slug), `${JSON.stringify(entry)}\n`);
  writeSnapshot(slug, next);
  return { entry, state: next };
}

const isInteger = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

function validateArgv(argv, label = 'argv') {
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((part) => typeof part !== 'string' || !part)) fail(`${label} must be a non-empty string array`);
  return argv;
}

function validateRelativeCwd(value, label) {
  if (value == null) return '.';
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || path.win32.isAbsolute(value) || value.split(/[\\/]/).includes('..')) fail(`${label} must be a relative path inside the repository`);
  return value;
}

function validateEntries(raw, label) {
  if (!Array.isArray(raw) || raw.length === 0) fail(`${label} needs at least one path`);
  const seen = new Set();
  return raw.map((entry) => {
    if (typeof entry !== 'string' || !entry || path.isAbsolute(entry) || path.win32.isAbsolute(entry) || entry.includes('\\')
      || entry.split('/').some((part, index, parts) => part === '..' || part === '.' || (!part && index < parts.length - 1))
      || entry === '.omj' || entry.startsWith('.omj/') || seen.has(entry)) fail(`${label} entry is not a clean relative path: ${entry}`);
    seen.add(entry);
    return entry;
  });
}

// Git pathspec semantics: an entry names a file or everything under it, with or without a trailing slash.
const entryPrefix = (entry) => (entry.endsWith('/') ? entry : `${entry}/`);
const overlaps = (a, b) => a === b || b.startsWith(entryPrefix(a)) || a.startsWith(entryPrefix(b));
const covers = (entries, file) => entries.some((entry) => file === entry || file.startsWith(entryPrefix(entry)));

function validateExperiment(id, raw) {
  const where = `${id} experiment`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`${where} config is required`);
  const metric = raw.metric ?? {};
  if (typeof metric.name !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(metric.name)) fail(`${where} metric.name must match [A-Za-z0-9_.-]+`);
  if (!['lower', 'higher'].includes(metric.direction)) fail(`${where} metric.direction must be lower or higher`);
  if (metric.deterministic != null && typeof metric.deterministic !== 'boolean') fail(`${where} metric.deterministic must be a boolean`);
  const deterministic = metric.deterministic === true;
  const evaluator = raw.evaluator ?? {};
  validateArgv(evaluator.argv, `${where} evaluator.argv`);
  const timeoutSeconds = evaluator.timeoutSeconds ?? 600;
  if (!isInteger(timeoutSeconds, 1, 3600)) fail(`${where} evaluator.timeoutSeconds must be an integer from 1 to 3600`);
  const repeats = evaluator.repeats ?? 3;
  if (!isInteger(repeats, 1, 5)) fail(`${where} evaluator.repeats must be an integer from 1 to 5`);
  if (!deterministic && repeats < 3) fail(`${where} needs evaluator.repeats of 3 or more unless metric.deterministic is true`);
  const cwd = validateRelativeCwd(evaluator.cwd, `${where} evaluator.cwd`);
  if (!Array.isArray(raw.guards) || raw.guards.length === 0) fail(`${where} needs at least one guard`);
  const guards = raw.guards.map((guard, index) => {
    validateArgv(guard?.argv, `${where} guards[${index}].argv`);
    const guardTimeout = guard.timeoutSeconds ?? timeoutSeconds;
    if (!isInteger(guardTimeout, 1, 3600)) fail(`${where} guards[${index}].timeoutSeconds must be an integer from 1 to 3600`);
    return { argv: guard.argv, cwd: validateRelativeCwd(guard.cwd, `${where} guards[${index}].cwd`), timeoutSeconds: guardTimeout };
  });
  const scope = validateEntries(raw.scope, `${where} scope`);
  const sealed = validateEntries(raw.sealed, `${where} sealed`);
  for (const a of scope) for (const b of sealed) if (overlaps(a, b)) fail(`${where} scope and sealed overlap: ${a} / ${b}`);
  for (const entry of [...scope, ...sealed]) {
    const absolute = path.join(projectRoot(), entry);
    if (!entry.endsWith('/') && existsSync(absolute) && lstatSync(absolute).isDirectory()) fail(`${where} directory entries end with /: ${entry}`);
    if (git(['check-ignore', '-q', '--', entry], { allowFailure: true }).status === 0) fail(`${where} entry is ignored by git: ${entry}`);
  }
  if (!isInteger(raw.maxTrials, 1, 100)) fail(`${where} maxTrials must be an integer from 1 to 100`);
  if (raw.patience != null && !isInteger(raw.patience, 1, 100)) fail(`${where} patience must be an integer from 1 to 100`);
  const minImprovement = raw.minImprovement ?? 0;
  if (!Number.isFinite(minImprovement) || minImprovement < 0) fail(`${where} minImprovement must be a number of 0 or more`);
  if (raw.target != null && !Number.isFinite(raw.target)) fail(`${where} target must be a finite number`);
  return {
    metric: { name: metric.name, direction: metric.direction, deterministic },
    evaluator: { argv: evaluator.argv, cwd, timeoutSeconds, repeats },
    guards,
    scope,
    sealed,
    maxTrials: raw.maxTrials,
    ...(raw.patience != null ? { patience: raw.patience } : {}),
    minImprovement,
    ...(raw.target != null ? { target: raw.target } : {}),
  };
}

function validateGoals(raw) {
  if (!Array.isArray(raw) || raw.length === 0) fail('goals must be a non-empty array');
  const ids = new Set();
  return raw.map((goal, index) => {
    const id = goal.id ?? `G${String(index + 1).padStart(3, '0')}`;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id) || ids.has(id)) fail(`invalid or duplicate goal id: ${id}`);
    ids.add(id);
    if (typeof goal.title !== 'string' || !goal.title.trim() || typeof goal.objective !== 'string' || !goal.objective.trim()) {
      fail(`${id} requires title and objective`);
    }
    if (!GOAL_KINDS.includes(goal.kind)) fail(`${id} kind must be change, report, or experiment`);
    if (!Array.isArray(goal.acceptance) || goal.acceptance.length === 0 || goal.acceptance.some((item) => typeof item !== 'string' || !item.trim())) {
      fail(`${id} requires explicit acceptance criteria`);
    }
    if (goal.kind !== 'experiment' && goal.experiment !== undefined) fail(`${id} experiment config is only valid on experiment goals`);
    const experiment = goal.kind === 'experiment' ? { experiment: validateExperiment(id, goal.experiment) } : {};
    return { id, title: goal.title.trim(), objective: goal.objective.trim(), kind: goal.kind, acceptance: goal.acceptance, ...experiment };
  });
}

function validAcceptanceEvidence(goal, evidence) {
  return Array.isArray(evidence)
    && evidence.length === goal.acceptance.length
    && evidence.every((item, index) => item?.criterion === goal.acceptance[index] && typeof item.evidence === 'string' && item.evidence.trim());
}

function validatePr(pr) {
  if (pr == null) return null;
  if (!pr || typeof pr !== 'object' || pr.host !== 'github.com') fail('pr.host must be github.com');
  if (typeof pr.repo !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(pr.repo)) fail('pr.repo must be owner/name');
  if (!Number.isInteger(pr.number) || pr.number <= 0 || !/^[0-9a-f]{40}$/i.test(pr.headSha ?? '')) fail('pr requires positive number and 40-character headSha');
  if (typeof pr.deliveryRequired !== 'boolean') fail('pr.deliveryRequired boolean is required');
  if (!Array.isArray(pr.findings)) fail('pr.findings must be an array');
  const ids = new Set();
  for (const finding of pr.findings) {
    if (!finding?.id || ids.has(finding.id)) fail('each PR finding needs a unique id');
    ids.add(finding.id);
  }
  return { ...pr, findings: pr.findings.map(({ id, title = '' }) => ({ id, title })) };
}

function artifact(slug, kind, payload) {
  const id = `${kind}-${Date.now()}-${randomUUID()}.json`;
  mkdirSync(evidenceFor(slug), { recursive: true });
  const target = path.join(evidenceFor(slug), id);
  const temp = `${target}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`);
  renameSync(temp, target);
  return { path: `evidence/${id}`, hash: sha256(readFileSync(target)) };
}

function validateArtifact(slug, receipt) {
  if (typeof receipt.artifact !== 'string' || !/^evidence\/[A-Za-z0-9._-]+\.json$/.test(receipt.artifact)) fail('invalid evidence artifact path');
  const target = path.join(rootFor(slug), receipt.artifact);
  if (!existsSync(target) || sha256(readFileSync(target)) !== receipt.artifactHash) fail(`evidence artifact missing or tampered: ${receipt.artifact}`);
}

function readArtifactJson(slug, receipt) {
  validateArtifact(slug, receipt);
  return JSON.parse(readFileSync(path.join(rootFor(slug), receipt.artifact), 'utf8'));
}

const latestReview = (state, scope, fingerprint) =>
  [...state.reviews].reverse().find((review) => review.scope === scope && review.fingerprint === fingerprint);

function eligibleProof(state, scope, fingerprint, kind) {
  const matching = state.proofs.filter((proof) => proof.scope === scope && proof.fingerprint === fingerprint && proof.kind === kind);
  if (kind === 'report') return matching.at(-1) ?? null;
  if (matching.length === 0) return null;
  const latestByCommand = new Map();
  for (const proof of matching) latestByCommand.set(canonical({ argv: proof.argv, cwd: proof.cwd }), proof);
  if ([...latestByCommand.values()].some((proof) => proof.exitCode !== 0 || !proof.stable)) return null;
  return matching.at(-1);
}

function flakyChecks(state) {
  const groups = new Map();
  for (const proof of state.proofs.filter((item) => item.kind === 'command')) {
    const key = canonical({ scope: proof.scope, argv: proof.argv, cwd: proof.cwd, fingerprint: proof.fingerprint });
    const group = groups.get(key) ?? { scope: proof.scope, argv: proof.argv, cwd: proof.cwd, fingerprint: proof.fingerprint, exitCodes: [] };
    group.exitCodes.push(proof.exitCode);
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.exitCodes.includes(0) && group.exitCodes.some((code) => code !== 0));
}

function requireScope(input, state, { finalAllowed = true } = {}) {
  if (input.scope === 'final' && finalAllowed) {
    if (state.goals.some((goal) => goal.status !== 'complete')) fail('final scope requires every goal complete');
    return 'final';
  }
  const goalId = input.scope?.goalId;
  if (!state.goals.some((goal) => goal.id === goalId)) fail('scope must name an existing goalId or be final');
  if (state.goals.find((goal) => goal.id === goalId).status !== 'active') fail('goal-scoped proof/review requires an active goal');
  return goalId;
}

function safeCwd(value) {
  if (value == null) return projectRoot();
  if (typeof value !== 'string' || path.isAbsolute(value) || path.win32.isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
    fail('cwd must be a relative path inside the repository');
  }
  const top = projectRoot();
  const realTop = realpathSync(top);
  const target = path.resolve(top, value);
  let real;
  try { real = realpathSync(target); } catch { fail('cwd must name an existing directory inside the repository'); }
  if (real !== realTop && !real.startsWith(`${realTop}${path.sep}`)) fail('cwd must stay inside the repository');
  return real;
}

// Command execution. The helper stays synchronous: it starts a runner (this file in
// `__run` mode, in the helper's own process group) and waits for it. The runner starts
// the command as the leader of a new process group on POSIX, so a timeout, an
// interrupting signal, or the command's own exit can end every process it started.
// Output goes to files, so a lingering process cannot hold the helper open.

function killGroup(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  try { process.kill(process.platform === 'win32' ? pid : -pid, 'SIGKILL'); } catch {}
}

function writeJsonAtomic(target, value) {
  const temp = `${target}.tmp-${process.pid}-${randomUUID()}`;
  writeFileSync(temp, `${JSON.stringify(value)}\n`);
  renameSync(temp, target);
}

function runnerMain(specPath) {
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const posix = process.platform !== 'win32';
  const out = openSync(spec.stdoutPath, 'w');
  const err = openSync(spec.stderrPath, 'w');
  let child;
  let timer = null;
  let timedOut = false;
  let done = false;
  const killTree = () => {
    if (!child?.pid) return;
    if (posix) killGroup(child.pid);
    else try { child.kill('SIGKILL'); } catch {}
  };
  const finish = (result) => {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    writeJsonAtomic(spec.resultPath, result);
    closeSync(out);
    closeSync(err);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      killTree();
      finish({ exitCode: 1, signal, timedOut: false, error: `runner received ${signal}` });
      process.exit(1);
    });
  }
  try {
    child = spawn(spec.argv[0], spec.argv.slice(1), { cwd: spec.cwd, stdio: ['ignore', out, err], detached: posix, windowsHide: true });
  } catch (error) {
    finish({ exitCode: 1, signal: null, timedOut: false, error: error.message });
    return;
  }
  if (spec.markerPath && child.pid && existsSync(spec.markerPath)) {
    try { writeJsonAtomic(spec.markerPath, { ...JSON.parse(readFileSync(spec.markerPath, 'utf8')), pgid: child.pid }); } catch {}
  }
  if (spec.timeoutMs) {
    timer = setTimeout(() => {
      timedOut = true;
      killTree();
    }, spec.timeoutMs);
  }
  child.on('error', (error) => finish({ exitCode: 1, signal: null, timedOut: false, error: error.message }));
  child.on('exit', (code, signal) => {
    killTree();
    finish({ exitCode: timedOut ? 124 : Number.isInteger(code) ? code : 1, signal: signal ?? null, timedOut });
  });
}

function readTail(file, chars) {
  let size;
  try { size = statSync(file).size; } catch { return ''; }
  const length = Math.min(size, chars * 4);
  if (length === 0) return '';
  const fd = openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    return buffer.toString('utf8').slice(-chars);
  } finally {
    closeSync(fd);
  }
}

function lastMetric(file, name) {
  const escaped = name.replace(/[.*+?^$()|[\]\\{}-]/g, '\\$&');
  const pattern = new RegExp('^METRIC\\s+' + escaped + '=(\\S+)\\s*$');
  let fd;
  try { fd = openSync(file, 'r'); } catch { return { raw: null, value: null }; }
  let found = null;
  let rest = '';
  try {
    const decoder = new StringDecoder('utf8');
    const buffer = Buffer.alloc(1 << 20);
    let position = 0;
    let read;
    while ((read = readSync(fd, buffer, 0, buffer.length, position)) > 0) {
      position += read;
      const lines = (rest + decoder.write(buffer.subarray(0, read))).split(/\r?\n/);
      rest = lines.pop();
      for (const line of lines) {
        const match = pattern.exec(line);
        if (match) found = match[1];
      }
    }
    const match = pattern.exec(rest + decoder.end());
    if (match) found = match[1];
  } finally {
    closeSync(fd);
  }
  const value = found === null ? NaN : Number(found);
  return { raw: found, value: Number.isFinite(value) ? value : null };
}

function runCommand(argv, cwd, { timeoutSeconds = null, tail = VERIFY_TAIL, markerPath = null, metricName = null } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'omj-run-'));
  try {
    const spec = {
      argv,
      cwd: safeCwd(cwd),
      timeoutMs: timeoutSeconds ? timeoutSeconds * 1000 : null,
      stdoutPath: path.join(dir, 'stdout'),
      stderrPath: path.join(dir, 'stderr'),
      resultPath: path.join(dir, 'result.json'),
      markerPath,
    };
    writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec));
    const runner = spawnSync(process.execPath, [SELF, '__run', path.join(dir, 'spec.json')], { stdio: 'ignore' });
    const result = existsSync(spec.resultPath)
      ? JSON.parse(readFileSync(spec.resultPath, 'utf8'))
      : { exitCode: 1, signal: runner.signal ?? null, timedOut: false, error: 'runner produced no result' };
    const parsed = metricName ? lastMetric(spec.stdoutPath, metricName) : null;
    return {
      exitCode: result.exitCode,
      signal: result.signal ?? null,
      timedOut: result.timedOut === true,
      error: result.error ?? null,
      stdout: readTail(spec.stdoutPath, tail),
      stderr: readTail(spec.stderrPath, tail),
      metric: parsed?.value ?? null,
      metricRaw: parsed?.raw ?? null,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function optionalTimeout(value) {
  if (value == null) return null;
  if (!isInteger(value, 1, 3600)) fail('timeoutSeconds must be an integer from 1 to 3600');
  return value;
}

// Experiment trees. A tree maps each git-visible path under the entries to its bytes,
// mode, and hash, or to null when a tracked path is missing from disk.

function listPaths(entries) {
  const listed = git(['--literal-pathspecs', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...entries]).stdout;
  return [...new Set(listed.split('\0').filter(Boolean))].sort();
}

function readTree(entries, { limit = SNAPSHOT_LIMIT, label = 'scope' } = {}) {
  const top = projectRoot();
  const files = {};
  let total = 0;
  for (const file of listPaths(entries)) {
    const absolute = path.join(top, file);
    let stat;
    try { stat = lstatSync(absolute); } catch { files[file] = null; continue; }
    if (!stat.isFile()) fail(`${label} entries must be regular files: ${file}`);
    const bytes = readFileSync(absolute);
    total += bytes.length;
    if (total > limit) fail(`${label} exceeds ${limit} bytes — narrow the approved ${label}`);
    files[file] = { mode: stat.mode & 0o777, bytes, sha256: sha256(bytes) };
  }
  return files;
}

const treeDigest = (files) => Object.fromEntries(Object.entries(files).map(([file, entry]) => [file, entry ? { mode: entry.mode, sha256: entry.sha256 } : 'absent']));
const treeHash = (files) => sha256(canonical(treeDigest(files)));
const encodeTree = (files) => Object.fromEntries(Object.entries(files).map(([file, entry]) => [file, entry ? { mode: entry.mode, sha256: entry.sha256, base64: entry.bytes.toString('base64') } : null]));

function dirtyPaths() {
  return new Set([
    ...git(['diff', '--name-only', '-z', 'HEAD']).stdout.split('\0'),
    ...git(['ls-files', '--others', '--exclude-standard', '-z']).stdout.split('\0'),
  ].filter(Boolean));
}

function outsideDigest(config) {
  const top = projectRoot();
  const map = {};
  for (const file of [...dirtyPaths()].sort()) {
    if (file.startsWith('.omj/goals/') || covers(config.scope, file) || covers(config.sealed, file)) continue;
    const absolute = path.join(top, file);
    let entry = 'deleted';
    try {
      const stat = lstatSync(absolute);
      entry = stat.isSymbolicLink() ? `symlink:${readlinkSync(absolute)}` : sha256(readFileSync(absolute));
    } catch {}
    map[file] = entry;
  }
  return map;
}

function firstDifference(expected, actual) {
  const keys = [...new Set([...Object.keys(expected ?? {}), ...Object.keys(actual ?? {})])].sort();
  return keys.find((key) => canonical(expected?.[key] ?? null) !== canonical(actual?.[key] ?? null)) ?? null;
}

function writeFileExact(file, bytes, mode) {
  const absolute = path.join(projectRoot(), file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, bytes);
  chmodSync(absolute, mode);
}

function restoreScope(entries, snapshotFiles) {
  const top = projectRoot();
  for (const file of listPaths(entries)) {
    if (!snapshotFiles[file]) rmSync(path.join(top, file), { force: true });
  }
  for (const [file, entry] of Object.entries(snapshotFiles)) {
    if (entry) writeFileExact(file, Buffer.from(entry.base64, 'base64'), entry.mode);
  }
}

function restoreSealed(entries, baselineDigest, sealedFiles) {
  const top = projectRoot();
  const current = treeDigest(readTree(entries, { limit: Infinity, label: 'sealed' }));
  for (const file of Object.keys(current)) {
    if (!(file in baselineDigest)) rmSync(path.join(top, file), { force: true });
  }
  for (const [file, digest] of Object.entries(baselineDigest)) {
    if (digest === 'absent') {
      rmSync(path.join(top, file), { force: true });
    } else if (canonical(current[file] ?? null) !== canonical(digest)) {
      // --filters applies the checkout conversions (eol, smudge), so the bytes match the working tree at baseline.
      const bytes = sealedFiles[file] ? Buffer.from(sealedFiles[file].base64, 'base64') : gitBuffer(['cat-file', '--filters', `HEAD:${file}`]);
      writeFileExact(file, bytes, digest.mode);
    }
  }
  return firstDifference(baselineDigest, treeDigest(readTree(entries, { limit: Infinity, label: 'sealed' })));
}

function candidateFiles(current, best) {
  const files = {};
  const hashes = {};
  let total = 0;
  let truncated = false;
  for (const file of [...new Set([...Object.keys(current), ...Object.keys(best)])].sort()) {
    const now = current[file] ?? null;
    const then = best[file] ?? null;
    if (now && then ? now.sha256 === then.sha256 && now.mode === then.mode : now === then) continue;
    hashes[file] = now ? now.sha256 : 'absent';
    if (!now) { files[file] = null; continue; }
    total += now.bytes.length;
    if (total > CANDIDATE_LIMIT) { truncated = true; continue; }
    files[file] = { mode: now.mode, base64: now.bytes.toString('base64') };
  }
  return { files, hashes, truncated };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function readMarker(slug) {
  if (!existsSync(markerFor(slug))) return null;
  try { return JSON.parse(readFileSync(markerFor(slug), 'utf8')); } catch { fail('pending trial marker is unreadable — inspect the experiment scope before removing it'); }
}

function currentHead() {
  const result = git(['rev-parse', 'HEAD'], { allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function trialSummary(state, goal, extra) {
  const exp = state.experiments[goal.id];
  return {
    ...extra,
    best: exp.best && { value: exp.best.value, n: exp.best.n },
    baseline: exp.baseline && { value: exp.baseline.value, spread: exp.baseline.spread },
    trialsLeft: goal.experiment.maxTrials - exp.normalTrials,
    stopReason: exp.stopReason,
    revision: state.revision,
  };
}

function recoverInterrupted(slug, state, goal, marker) {
  const exp = state.experiments[goal.id];
  const config = goal.experiment;
  const helperError = typeof marker.error === 'string' && marker.error ? marker.error : null;
  const bootedAt = Date.now() - uptime() * 1000;
  // A helper error ended the call itself, so its runner already cleaned up; a marker from before the last boot names a reused pid.
  if (!helperError && !(Date.parse(marker.startedAt) < bootedAt)) killGroup(marker.pgid);
  const bestSnapshot = exp.best ? readArtifactJson(slug, exp.best.snapshot) : null;
  const candidate = bestSnapshot ? candidateFiles(readTree(config.scope), bestSnapshot.files) : null;
  if (bestSnapshot) restoreScope(config.scope, bestSnapshot.files);
  const fingerprint = workspaceFingerprint().sha256;
  const restored = bestSnapshot ? fingerprint === exp.best.fingerprint : null;
  const n = exp.trials.length;
  const repair = marker.repair === true;
  const hypothesis = typeof marker.hypothesis === 'string' && marker.hypothesis.trim() ? marker.hypothesis : 'interrupted trial';
  const reason = helperError ? `helper error: ${helperError}` : 'interrupted';
  const file = artifact(slug, 'trial', {
    schemaVersion: state.schemaVersion, kind: 'trial', goalId: goal.id, n, hypothesis, repair, decision: 'crash', reason,
    values: [], value: null, delta: null, threshold: null, runs: [], guards: [], candidate, restored, fingerprint, createdAt: new Date().toISOString(),
  });
  const trial = {
    n, hypothesis, repair, decision: 'crash', values: [], value: null, delta: null, threshold: null, reason,
    restored, fingerprint, artifact: file.path, artifactHash: file.hash,
  };
  const next = append(slug, state, { type: 'trial_recorded', goalId: goal.id, trial }).state;
  rmSync(markerFor(slug), { force: true });
  return ok(trialSummary(next, goal, { recovered: true, n, decision: 'crash', reason, restored, artifact: file.path, fingerprint }));
}

function runTrial(slug, state, input) {
  if (state.schemaVersion < 3) fail('trial requires a schema v3 ledger');
  const goal = state.goals.find((item) => item.id === input.goalId);
  if (!goal || goal.kind !== 'experiment' || goal.status !== 'active') fail('trial requires the active experiment goal');
  if (typeof input.hypothesis !== 'string' || !input.hypothesis.trim() || input.hypothesis.length > 500) fail('trial hypothesis must be 1-500 characters');
  if (input.repair != null && typeof input.repair !== 'boolean') fail('repair must be a boolean');
  const repair = input.repair === true;
  const hypothesis = input.hypothesis.trim();
  const exp = state.experiments[goal.id];
  const config = goal.experiment;
  const marker = readMarker(slug);
  if (marker) {
    if (marker.goalId !== goal.id) fail(`a pending trial for ${marker.goalId} must be recovered first`);
    if (Number.isInteger(marker.n) && marker.n < exp.trials.length) {
      rmSync(markerFor(slug), { force: true });
      return ok(trialSummary(state, goal, { recovered: true, alreadyRecorded: true, n: marker.n }));
    }
    return recoverInterrupted(slug, state, goal, marker);
  }
  const head = currentHead();
  if (!head) fail('experiment goals need a commit');
  if (exp.baseline && head !== exp.baselineHead) fail('HEAD moved since baseline');
  if (repair) {
    if (!exp.best) fail('repair needs a best measured state');
    if (latestReview(state, goal.id, exp.best.fingerprint)?.verdict !== 'fail') fail('repair needs a failing goal review at the best state');
  } else if (exp.stopReason) {
    fail(`experiment stopped: ${exp.stopReason}`);
  }
  const scopeFiles = readTree(config.scope);
  if (!exp.baseline && treeHash(scopeFiles) !== exp.startScopeHash) fail('scope changed since the goal started — the baseline measures the starting code');
  const sealedTree = readTree(config.sealed, { limit: Infinity, label: 'sealed' });
  const sealedNow = treeDigest(sealedTree);
  const outsideNow = outsideDigest(config);
  const bestSnapshot = exp.best ? readArtifactJson(slug, exp.best.snapshot) : null;
  const candidate = bestSnapshot ? candidateFiles(scopeFiles, bestSnapshot.files) : null;
  const n = exp.trials.length;
  let decision = null;
  let reason = null;
  let sealedChanged = false;
  if (exp.baseline) {
    const sealedDiff = firstDifference(exp.sealedBaseline, sealedNow);
    const outsideDiff = firstDifference(exp.outsideBaseline, outsideNow);
    if (sealedDiff) { decision = 'invalid'; reason = `sealed file changed: ${sealedDiff}`; sealedChanged = true; }
    else if (outsideDiff) { decision = 'invalid'; reason = `edit outside scope: ${outsideDiff}`; }
  }
  // Deterministic checks run before the marker, so a marker left behind always means the call itself was cut short.
  safeCwd(config.evaluator.cwd);
  for (const guard of config.guards) safeCwd(guard.cwd);
  let baselineSealedFiles = null;
  if (!exp.baseline) {
    const dirty = dirtyPaths();
    baselineSealedFiles = Object.fromEntries(Object.entries(sealedTree).filter(([file, entry]) => entry && dirty.has(file)));
    if (Object.values(baselineSealedFiles).reduce((sum, entry) => sum + entry.bytes.length, 0) > SNAPSHOT_LIMIT) fail(`uncommitted sealed files exceed ${SNAPSHOT_LIMIT} bytes — narrow the approved sealed set`);
  }
  const sealedCandidate = sealedChanged
    ? candidateFiles(sealedTree, Object.fromEntries(Object.entries(exp.sealedBaseline).map(([file, digest]) => [file, digest === 'absent' ? null : digest])))
    : null;
  writeJsonAtomic(markerFor(slug), { goalId: goal.id, n, repair, hypothesis, pgid: null, startedAt: new Date().toISOString() });
  try {
    return measureAndRecord();
  } catch (error) {
    markHelperError(slug, error);
    throw error;
  }

  function measureAndRecord() {
  const runs = [];
  const guards = [];
  const values = [];
  const measure = (command, options) => {
    const before = workspaceFingerprint().sha256;
    const run = runCommand(command.argv, command.cwd, { tail: TRIAL_TAIL, markerPath: markerFor(slug), ...options });
    const stable = before === workspaceFingerprint().sha256;
    return { argv: command.argv, cwd: command.cwd, exitCode: run.exitCode, signal: run.signal, timedOut: run.timedOut, error: run.error, stable, metric: run.metric, metricRaw: run.metricRaw, stdout: run.stdout, stderr: run.stderr };
  };
  if (!decision) {
    for (let index = 0; index < config.evaluator.repeats; index += 1) {
      const run = measure(config.evaluator, { timeoutSeconds: config.evaluator.timeoutSeconds, metricName: config.metric.name });
      runs.push(run);
      if (!run.stable) { decision = 'invalid'; reason = 'evaluator changed the workspace'; break; }
      if (run.exitCode !== 0 || run.metric === null) {
        decision = 'crash';
        reason = run.timedOut ? 'evaluator timed out'
          : run.exitCode !== 0 ? `evaluator exited ${run.exitCode}`
            : run.metricRaw === null ? `no METRIC ${config.metric.name}= line`
              : `METRIC ${config.metric.name}= value is not a finite number: ${run.metricRaw.slice(0, 80)}`;
        break;
      }
      values.push(run.metric);
    }
  }
  let value = null;
  let delta = null;
  let threshold = null;
  let spread = null;
  if (!decision) {
    value = median(values);
    if (!exp.baseline) {
      decision = 'baseline';
      spread = Math.max(...values) - Math.min(...values);
    } else {
      delta = config.metric.direction === 'lower' ? exp.best.value - value : value - exp.best.value;
      threshold = Math.max(config.minImprovement, exp.baseline.spread);
      if (repair || delta > threshold) {
        for (const guard of config.guards) {
          const run = measure(guard, { timeoutSeconds: guard.timeoutSeconds });
          guards.push(run);
          if (run.exitCode !== 0 || !run.stable) {
            decision = 'guard_failed';
            reason = !run.stable ? `guard changed the workspace: ${guard.argv.join(' ')}` : `guard exited ${run.exitCode}: ${guard.argv.join(' ')}`;
            break;
          }
        }
        if (!decision) decision = repair ? 'repair' : 'keep';
      } else {
        decision = 'discard';
        reason = `improvement ${delta} is not above the threshold ${threshold}`;
      }
    }
  }
  let snapshot = null;
  let integrity = null;
  let restored = null;
  let fingerprint = workspaceFingerprint().sha256;
  if (['baseline', 'keep', 'repair'].includes(decision)) {
    const payload = { schemaVersion: state.schemaVersion, kind: 'snapshot', goalId: goal.id, n, scopeHash: treeHash(scopeFiles), files: encodeTree(scopeFiles) };
    if (decision === 'baseline') {
      payload.sealedFiles = encodeTree(baselineSealedFiles);
      integrity = { sealed: sealedNow, outside: outsideNow, head };
    }
    const file = artifact(slug, 'snapshot', payload);
    snapshot = { artifact: file.path, artifactHash: file.hash, scopeHash: payload.scopeHash };
  } else if (exp.baseline) {
    if (sealedChanged) {
      const remaining = restoreSealed(config.sealed, exp.sealedBaseline, readArtifactJson(slug, exp.baseline.snapshot).sealedFiles ?? {});
      if (remaining) reason += `; sealed restore still differs: ${remaining}`;
    }
    restoreScope(config.scope, bestSnapshot.files);
    fingerprint = workspaceFingerprint().sha256;
    restored = fingerprint === exp.best.fingerprint;
  }
  const file = artifact(slug, 'trial', {
    schemaVersion: state.schemaVersion, kind: 'trial', goalId: goal.id, n, hypothesis, repair, decision, reason, values, value, delta, threshold, spread,
    runs, guards, candidate, ...(sealedCandidate ? { sealedCandidate } : {}), restored, fingerprint, createdAt: new Date().toISOString(),
  });
  const trial = {
    n, hypothesis, repair, decision, values, value, delta, threshold, reason, restored, fingerprint, artifact: file.path, artifactHash: file.hash,
    ...(spread !== null ? { spread } : {}),
    ...(snapshot ? { snapshot } : {}),
    ...(integrity ? { integrity } : {}),
  };
  const next = append(slug, state, { type: 'trial_recorded', goalId: goal.id, trial }).state;
  rmSync(markerFor(slug), { force: true });
  return ok(trialSummary(next, goal, { n, decision, value, values, delta, threshold, reason, restored, artifact: file.path, fingerprint }));
  }
}

function markHelperError(slug, error) {
  try {
    if (!existsSync(markerFor(slug))) return;
    const marker = JSON.parse(readFileSync(markerFor(slug), 'utf8'));
    writeJsonAtomic(markerFor(slug), { ...marker, error: String(error.detail ?? error.message).slice(0, 500) });
  } catch {}
}

function init(slug, input) {
  if (existsSync(rootFor(slug))) fail(`.omj/goals/${slug}/ already exists`);
  if (typeof input.brief !== 'string' || !input.brief.trim()) fail('brief is required');
  const brief = input.brief.endsWith('\n') ? input.brief : `${input.brief}\n`;
  const goals = validateGoals(input.goals);
  const pr = validatePr(input.pr);
  const identity = repoIdentity();
  const initialFingerprint = workspaceFingerprint();
  const planHash = sha256(canonical({ brief, goals, pr }));
  const event = {
    seq: 1,
    ts: new Date().toISOString(),
    type: 'initialized',
    schemaVersion: SCHEMA_VERSION,
    slug,
    planHash,
    identity,
    initialFingerprint,
    goals,
    pr,
  };
  const temp = `${rootFor(slug)}.tmp-${process.pid}`;
  try {
    mkdirSync(path.join(temp, 'evidence'), { recursive: true });
    writeFileSync(path.join(temp, 'brief.md'), brief);
    writeFileSync(path.join(temp, 'ledger.jsonl'), `${JSON.stringify(event)}\n`);
    writeSnapshot(slug, deriveState([event]), temp);
    renameSync(temp, rootFor(slug));
  } catch (error) {
    rmSync(temp, { recursive: true, force: true });
    throw error;
  }
  ok({ initialized: slug, revision: 1, planHash });
}

function mutate(slug, verb, input) {
  const { state } = load(slug, { tolerateSnapshot: verb === 'reconcile' });
  requireRevision(input, state);
  if (verb === 'reconcile') {
    writeSnapshot(slug, state);
    return ok({ reconciled: slug, revision: state.revision });
  }
  if (state.closed) fail('plan is already closed');
  if (verb === 'start' || verb === 'resume') {
    const goal = state.goals.find((item) => item.id === input.goalId);
    if (!goal) fail(`unknown goal: ${input.goalId}`);
    const expected = verb === 'start' ? 'pending' : 'blocked';
    if (goal.status !== expected) fail(`${verb} requires ${expected} status`);
    const active = state.goals.find((item) => item.status === 'active');
    if (active) fail(`single active goal rule: ${active.id} is active`);
    const event = { type: verb === 'start' ? 'goal_started' : 'goal_resumed', goalId: goal.id };
    if (goal.kind === 'experiment' && (verb === 'start' || !state.experiments[goal.id].baseline)) event.startScopeHash = treeHash(readTree(goal.experiment.scope));
    const result = append(slug, state, event);
    return ok({ goalId: goal.id, status: 'active', revision: result.state.revision });
  }
  if (verb === 'block') {
    const goal = state.goals.find((item) => item.id === input.goalId);
    if (!goal || goal.status !== 'active') fail('block requires an active goal');
    if (typeof input.reason !== 'string' || !input.reason.trim()) fail('block reason is required');
    const result = append(slug, state, { type: 'goal_blocked', goalId: goal.id, reason: input.reason.trim() });
    return ok({ goalId: goal.id, status: 'blocked', revision: result.state.revision });
  }
  if (verb === 'trial') return runTrial(slug, state, input);
  if (verb === 'verify') {
    const scope = requireScope(input, state);
    validateArgv(input.argv);
    const timeoutSeconds = optionalTimeout(input.timeoutSeconds);
    const before = workspaceFingerprint();
    const run = runCommand(input.argv, input.cwd, { timeoutSeconds });
    const after = workspaceFingerprint();
    const data = {
      schemaVersion: state.schemaVersion,
      kind: 'command', scope, argv: input.argv, cwd: input.cwd ?? '.', exitCode: run.exitCode,
      signal: run.signal, timedOut: run.timedOut, ...(run.error ? { error: run.error } : {}), stdout: run.stdout, stderr: run.stderr,
      fingerprintBefore: before.sha256, fingerprint: after.sha256, headSha: after.headSha, createdAt: new Date().toISOString(),
    };
    const file = artifact(slug, 'verification', data);
    const proof = {
      kind: 'command', scope, argv: input.argv, cwd: input.cwd ?? '.', artifact: file.path, artifactHash: file.hash,
      exitCode: run.exitCode, stable: before.sha256 === after.sha256, fingerprint: after.sha256, headSha: after.headSha,
    };
    const next = append(slug, state, { type: 'proof_recorded', proof }).state;
    return ok({ artifact: file.path, exitCode: run.exitCode, stable: proof.stable, timedOut: run.timedOut, revision: next.revision, fingerprint: after.sha256 });
  }
  if (verb === 'evidence') {
    const scope = requireScope(input, state);
    if (scope !== 'final') {
      const goal = state.goals.find((item) => item.id === scope);
      if (goal.kind !== 'report') fail('evidence is only valid for report goals');
    } else if (state.goals.some((goal) => goal.kind !== 'report')) fail('final report evidence is valid only when every goal is report-only');
    if (typeof input.summary !== 'string' || !input.summary.trim()) fail('evidence summary is required');
    if (!Array.isArray(input.acceptance) || input.acceptance.length === 0 || input.acceptance.some((item) => typeof item !== 'string' || !item.trim())) fail('evidence acceptance must be non-empty');
    const fingerprint = workspaceFingerprint();
    const data = { schemaVersion: state.schemaVersion, kind: 'report', scope, summary: input.summary, acceptance: input.acceptance, fingerprint: fingerprint.sha256, headSha: fingerprint.headSha, createdAt: new Date().toISOString() };
    const file = artifact(slug, 'report', data);
    const proof = { kind: 'report', scope, artifact: file.path, artifactHash: file.hash, fingerprint: fingerprint.sha256, headSha: fingerprint.headSha };
    const next = append(slug, state, { type: 'proof_recorded', proof }).state;
    return ok({ artifact: file.path, revision: next.revision, fingerprint: fingerprint.sha256 });
  }
  if (verb === 'review') {
    const scope = requireScope(input, state);
    if (typeof input.reviewer !== 'string' || !input.reviewer.trim() || !['pass', 'fail'].includes(input.verdict) || typeof input.summary !== 'string' || !input.summary.trim()) fail('review requires reviewer, pass|fail verdict, and summary');
    const fingerprint = workspaceFingerprint();
    const data = { schemaVersion: state.schemaVersion, kind: 'review', scope, reviewer: input.reviewer, verdict: input.verdict, summary: input.summary, fingerprint: fingerprint.sha256, headSha: fingerprint.headSha, createdAt: new Date().toISOString() };
    const file = artifact(slug, 'review', data);
    const review = { ...data, artifact: file.path, artifactHash: file.hash };
    const next = append(slug, state, { type: 'review_recorded', review }).state;
    return ok({ artifact: file.path, verdict: review.verdict, revision: next.revision, fingerprint: fingerprint.sha256 });
  }
  if (verb === 'finding') {
    if (!state.pr || !state.findings[input.id]) fail(`unknown PR finding: ${input.id}`);
    if (!['accepted', 'rejected'].includes(input.disposition) || typeof input.rationale !== 'string' || !input.rationale.trim()) fail('finding requires accepted|rejected disposition and rationale');
    let verificationArtifact = null;
    if (input.disposition === 'accepted' && input.verificationArtifact != null) {
      const proof = state.proofs.find((item) => item.artifact === input.verificationArtifact && item.kind === 'command' && item.exitCode === 0);
      if (!proof) fail('verificationArtifact must name a recorded passing command proof');
      verificationArtifact = proof.artifact;
    }
    const finding = { ...state.findings[input.id], disposition: input.disposition, rationale: input.rationale.trim(), verificationArtifact };
    const next = append(slug, state, { type: 'finding_dispositioned', finding }).state;
    return ok({ findingId: input.id, disposition: input.disposition, revision: next.revision });
  }
  if (verb === 'delivery') {
    if (!state.pr) fail('delivery requires a PR contract');
    const fingerprint = workspaceFingerprint();
    if (!fingerprint.headSha || input.headSha !== fingerprint.headSha) fail('delivery headSha must equal current git HEAD');
    const expectedPath = `/${state.pr.repo}/pull/${state.pr.number}`;
    const parsePrUrl = (value, label, reply = false) => {
      let parsed;
      try { parsed = new URL(value); } catch { fail(`${label} must be a valid HTTPS URL`); }
      const allowedPath = parsed.pathname === expectedPath || (reply && parsed.pathname === `${expectedPath}/files`);
      if (parsed.protocol !== 'https:' || parsed.hostname !== state.pr.host || !allowedPath) fail(`${label} must match the PR host, repo, and exact number`);
      return parsed;
    };
    parsePrUrl(input.url, 'delivery URL');
    if (!Array.isArray(input.replies)) fail('delivery replies must be an array');
    const seen = new Set();
    const seenUrls = new Set();
    for (const reply of input.replies) {
      if (!state.findings[reply?.findingId] || seen.has(reply.findingId)) fail('delivery replies must map unique known finding IDs');
      const parsed = parsePrUrl(reply.url, 'reply URL', true);
      if (!/^#(?:discussion_r\d+|r\d+|discussion-diff-\d+|issuecomment-\d+|pullrequestreview-\d+)$/.test(parsed.hash)) fail('reply URL must include a GitHub review/comment anchor');
      if (seenUrls.has(reply.url)) fail('each finding requires a distinct reply receipt URL');
      seen.add(reply.findingId);
      seenUrls.add(reply.url);
    }
    const delivery = { url: input.url, headSha: input.headSha, replies: input.replies, fingerprint: fingerprint.sha256, createdAt: new Date().toISOString() };
    const next = append(slug, state, { type: 'delivery_recorded', delivery }).state;
    return ok({ delivered: true, revision: next.revision, fingerprint: fingerprint.sha256 });
  }
  if (verb === 'complete') {
    const goal = state.goals.find((item) => item.id === input.goalId);
    if (!goal || goal.status !== 'active') fail('complete requires an active goal');
    const fingerprint = workspaceFingerprint().sha256;
    let experiment = null;
    if (goal.kind === 'experiment') {
      const exp = state.experiments[goal.id];
      const config = goal.experiment;
      if (readMarker(slug)?.goalId === goal.id) fail('a pending trial names this goal — call trial once to recover it before completing');
      if (!exp.baseline) fail('experiment has no baseline');
      if (exp.normalTrials < 1 && exp.stopReason !== 'target') fail('experiment needs at least one trial after the baseline');
      if (fingerprint !== exp.best.fingerprint) fail('workspace is not at the best measured state');
      const sealed = treeDigest(readTree(config.sealed, { limit: Infinity, label: 'sealed' }));
      if (firstDifference(exp.sealedBaseline, sealed)) fail('sealed files differ from the baseline');
      if (config.target !== undefined && !meetsTarget(config, exp.best.value)) fail('the best value misses the approved target');
      experiment = { bestTrial: exp.best.n, bestValue: exp.best.value, sealed };
    }
    const proofKind = proofKindFor(goal);
    const proof = eligibleProof(state, goal.id, fingerprint, proofKind);
    if (!proof) fail(`missing, failed, or stale ${proofKind} proof for ${goal.id}`);
    const review = latestReview(state, goal.id, fingerprint);
    if (!review || review.verdict !== 'pass') fail(`missing, failed, or stale independent review pass for ${goal.id}`);
    if (!validAcceptanceEvidence(goal, input.acceptanceEvidence)) fail('acceptanceEvidence must provide ordered {criterion,evidence} entries matching every acceptance criterion');
    const completion = { fingerprint, proofArtifact: proof.artifact, reviewArtifact: review.artifact, acceptanceEvidence: input.acceptanceEvidence, ...(experiment ? { experiment } : {}) };
    const next = append(slug, state, { type: 'goal_completed', goalId: goal.id, completion }).state;
    return ok({ goalId: goal.id, status: 'complete', revision: next.revision });
  }
  if (verb === 'close') {
    const incomplete = state.goals.filter((goal) => goal.status !== 'complete');
    if (incomplete.length) fail(`cannot close with incomplete goals: ${incomplete.map((goal) => goal.id).join(', ')}`);
    const fingerprint = workspaceFingerprint();
    const finalProof = eligibleProof(state, 'final', fingerprint.sha256, finalProofKind(state));
    if (!finalProof) fail('missing, failed, or stale final proof for current workspace fingerprint');
    if (input.reuseGoalReview != null && typeof input.reuseGoalReview !== 'boolean') fail('reuseGoalReview must be a boolean');
    const finalReview = latestReview(state, 'final', fingerprint.sha256);
    let finalReviewRecord;
    if (input.reuseGoalReview === true) {
      if (state.schemaVersion < 3) fail('reuseGoalReview requires a schema v3 ledger');
      if (state.goals.length !== 1) fail('reuseGoalReview requires a plan with exactly one goal');
      if (finalReview) fail('a final review exists for this fingerprint — close without reuseGoalReview');
      if (state.goals[0].completion.fingerprint !== fingerprint.sha256) fail('reuseGoalReview requires the workspace unchanged since the goal review');
      finalReviewRecord = { artifact: state.goals[0].completion.reviewArtifact, reused: true };
    } else {
      if (finalReview?.verdict !== 'pass') fail('missing, failed, or stale final independent review pass');
      finalReviewRecord = { artifact: finalReview.artifact, reused: false };
    }
    const experiments = {};
    for (const goal of state.goals.filter((item) => item.kind === 'experiment')) {
      const exp = state.experiments[goal.id];
      const scopeHash = treeHash(readTree(goal.experiment.scope));
      if (scopeHash !== exp.best.snapshot.scopeHash) fail(`experiment ${goal.id} scope changed after its best measured state`);
      const sealed = treeDigest(readTree(goal.experiment.sealed, { limit: Infinity, label: 'sealed' }));
      if (firstDifference(exp.sealedBaseline, sealed)) fail(`experiment ${goal.id} sealed files changed after its baseline`);
      experiments[goal.id] = { scope: scopeHash, sealed: sha256(canonical(sealed)) };
    }
    if (state.pr) {
      const findings = Object.values(state.findings);
      if (findings.some((finding) => !finding.disposition)) fail('all PR findings require accepted/rejected dispositions');
      const accepted = findings.filter((finding) => finding.disposition === 'accepted');
      for (const finding of accepted) {
        const individual = state.proofs.find((proof) => proof.artifact === finding.verificationArtifact && proof.exitCode === 0 && proof.fingerprint === fingerprint.sha256);
        if (!individual && !(finalProof.kind === 'command' && finalProof.exitCode === 0)) fail(`accepted finding ${finding.id} lacks current verification`);
      }
      if (state.pr.deliveryRequired) {
        if (!state.delivery || state.delivery.fingerprint !== fingerprint.sha256 || state.delivery.headSha !== fingerprint.headSha) fail('missing or stale PR delivery readback receipt');
        const replied = new Set(state.delivery.replies.map((reply) => reply.findingId));
        if (findings.some((finding) => !replied.has(finding.id))) fail('delivery requires one reply receipt URL per finding');
      }
    }
    const event = { type: 'plan_closed', fingerprint: fingerprint.sha256 };
    if (state.schemaVersion >= 3) {
      event.finalReview = finalReviewRecord;
      if (Object.keys(experiments).length) event.experiments = experiments;
    }
    const next = append(slug, state, event).state;
    return ok({ closed: slug, revision: next.revision, finalReview: finalReviewRecord });
  }
  fail(`unknown verb: ${verb}`);
}

function status(slug) {
  const { state, snapshotStatus } = load(slug, { tolerateSnapshot: true });
  const extra = { flakyChecks: flakyChecks(state) };
  if (state.experiments) {
    const fingerprint = workspaceFingerprint().sha256;
    const marker = existsSync(markerFor(slug)) ? readMarker(slug) : null;
    extra.experimentStatus = Object.fromEntries(Object.entries(state.experiments).map(([goalId, exp]) => {
      const goal = state.goals.find((item) => item.id === goalId);
      return [goalId, {
        atBest: exp.best ? exp.best.fingerprint === fingerprint : false,
        trialsLeft: goal.experiment.maxTrials - exp.normalTrials,
        stopReason: exp.stopReason,
        pendingTrial: marker?.goalId === goalId ? marker : null,
      }];
    }));
  }
  return ok({ ...state, snapshotStatus, ...extra });
}

function main() {
  const [verb, ...args] = process.argv.slice(2);
  if (verb === '__run') return runnerMain(args[0]);
  const slugIndex = args.indexOf('--slug');
  const slug = requireSlug(slugIndex >= 0 ? args[slugIndex + 1] : undefined);
  if (verb === 'status') return status(slug);
  const input = readInput();
  return withLock(slug, () => verb === 'init' ? init(slug, input) : mutate(slug, verb, input));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { main(); } catch (error) {
    if (error.message !== '__goal_state_failure__') {
      process.stderr.write(`goal-state: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
