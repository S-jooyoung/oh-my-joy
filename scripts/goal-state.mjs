#!/usr/bin/env node
/** Durable, provider-neutral state and evidence helper for OMJ ultragoal. */
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { hostname } from 'node:os';
import { pathToFileURL } from 'node:url';

export const SCHEMA_VERSION = 2;
export const GOAL_STATUSES = ['pending', 'active', 'complete', 'blocked'];
const EVENT_TYPES = new Set([
  'initialized', 'goal_started', 'goal_resumed', 'goal_blocked', 'proof_recorded',
  'review_recorded', 'finding_dispositioned', 'delivery_recorded', 'goal_completed', 'plan_closed',
]);

const fail = (message) => {
  process.stderr.write(`goal-state: ${message}\n`);
  process.exitCode = 1;
  throw new Error('__goal_state_failure__');
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

function requireSlug(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    fail('--slug allows lowercase letters, digits, and hyphens only');
  }
  return value;
}

function git(args, { allowFailure = false, cwd = projectRoot() } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0 && !allowFailure) fail(`git ${args.join(' ')} failed: ${(result.stderr || '').trim()}`);
  return result;
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
  return {
    schemaVersion: SCHEMA_VERSION,
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
}

export function deriveState(events) {
  if (events.length === 0 || events[0].type !== 'initialized') fail('ledger must begin with initialized');
  if (events[0].schemaVersion !== SCHEMA_VERSION) fail(`unsupported ledger schema version: ${events[0].schemaVersion}`);
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
    } else if (event.type === 'goal_resumed') {
      if (goal.status !== 'blocked' || state.goals.some((item) => item.status === 'active')) fail(`illegal goal_resumed event at seq ${event.seq}`);
      goal.status = 'active';
      goal.blockedReason = null;
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
    } else if (event.type === 'finding_dispositioned') {
      if (!state.pr || !event.finding || !state.findings[event.finding.id] || !['accepted', 'rejected'].includes(event.finding.disposition) || !event.finding.rationale) fail(`invalid finding_dispositioned event at seq ${event.seq}`);
      state.findings[event.finding.id] = event.finding;
    } else if (event.type === 'delivery_recorded') {
      if (!state.pr || !event.delivery?.fingerprint || !event.delivery?.headSha || !Array.isArray(event.delivery.replies)) fail(`invalid delivery_recorded event at seq ${event.seq}`);
      state.delivery = event.delivery;
    } else if (event.type === 'goal_completed') {
      if (goal.status !== 'active' || !event.completion) fail(`illegal goal_completed event at seq ${event.seq}`);
      const expectedKind = goal.kind === 'change' ? 'command' : 'report';
      const proof = eligibleProof(state, goal.id, event.completion.fingerprint, expectedKind);
      const review = latestReview(state, goal.id, event.completion.fingerprint);
      if (!proof || review?.verdict !== 'pass' || proof.artifact !== event.completion.proofArtifact || review.artifact !== event.completion.reviewArtifact) fail(`goal_completed at seq ${event.seq} lacks matching proof/review`);
      if (!validAcceptanceEvidence(goal, event.completion.acceptanceEvidence)) fail(`goal_completed at seq ${event.seq} lacks acceptance evidence`);
      goal.status = 'complete';
      goal.completion = event.completion;
    } else if (event.type === 'plan_closed') {
      if (state.goals.some((item) => item.status !== 'complete')) fail(`plan_closed at seq ${event.seq} has incomplete goals`);
      const kind = state.goals.some((item) => item.kind === 'change') ? 'command' : 'report';
      const finalProof = eligibleProof(state, 'final', event.fingerprint, kind);
      if (!finalProof || latestReview(state, 'final', event.fingerprint)?.verdict !== 'pass') fail(`plan_closed at seq ${event.seq} lacks final proof/review`);
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

function load(slug, { tolerateSnapshot = false } = {}) {
  const events = readLedger(slug);
  const state = deriveState(events);
  const brief = readFileSync(path.join(rootFor(slug), 'brief.md'), 'utf8');
  const expectedPlanHash = sha256(canonical({ brief, goals: events[0].goals, pr: events[0].pr ?? null }));
  if (state.planHash !== expectedPlanHash) fail('approved plan hash mismatch — brief or initialization ledger was modified');
  if (canonical(state.identity) !== canonical(repoIdentity())) fail('repository/worktree identity does not match the initialized plan');
  for (const receipt of [...state.proofs, ...state.reviews]) validateArtifact(slug, receipt);
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
  appendFileSync(ledgerFor(slug), `${JSON.stringify(entry)}\n`);
  const next = deriveState(readLedger(slug));
  writeSnapshot(slug, next);
  return { entry, state: next };
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
    if (!['change', 'report'].includes(goal.kind)) fail(`${id} kind must be change or report`);
    if (!Array.isArray(goal.acceptance) || goal.acceptance.length === 0 || goal.acceptance.some((item) => typeof item !== 'string' || !item.trim())) {
      fail(`${id} requires explicit acceptance criteria`);
    }
    return { id, title: goal.title.trim(), objective: goal.objective.trim(), kind: goal.kind, acceptance: goal.acceptance };
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
  const target = path.resolve(top, value);
  let real;
  try { real = realpathSync(target); } catch { fail('cwd must name an existing directory inside the repository'); }
  if (real !== top && !real.startsWith(`${top}${path.sep}`)) fail('cwd must stay inside the repository');
  return real;
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
    const result = append(slug, state, { type: verb === 'start' ? 'goal_started' : 'goal_resumed', goalId: goal.id });
    return ok({ goalId: goal.id, status: 'active', revision: result.state.revision });
  }
  if (verb === 'block') {
    const goal = state.goals.find((item) => item.id === input.goalId);
    if (!goal || goal.status !== 'active') fail('block requires an active goal');
    if (typeof input.reason !== 'string' || !input.reason.trim()) fail('block reason is required');
    const result = append(slug, state, { type: 'goal_blocked', goalId: goal.id, reason: input.reason.trim() });
    return ok({ goalId: goal.id, status: 'blocked', revision: result.state.revision });
  }
  if (verb === 'verify') {
    const scope = requireScope(input, state);
    if (!Array.isArray(input.argv) || input.argv.length === 0 || input.argv.some((part) => typeof part !== 'string' || !part)) fail('argv must be a non-empty string array');
    const before = workspaceFingerprint();
    const result = spawnSync(input.argv[0], input.argv.slice(1), {
      cwd: safeCwd(input.cwd), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
    });
    const after = workspaceFingerprint();
    const exitCode = Number.isInteger(result.status) ? result.status : 1;
    const data = {
      schemaVersion: SCHEMA_VERSION,
      kind: 'command', scope, argv: input.argv, cwd: input.cwd ?? '.', exitCode,
      signal: result.signal ?? null, stdout: (result.stdout ?? '').slice(-1_000_000), stderr: (result.stderr ?? '').slice(-1_000_000),
      fingerprintBefore: before.sha256, fingerprint: after.sha256, headSha: after.headSha, createdAt: new Date().toISOString(),
    };
    const file = artifact(slug, 'verification', data);
    const proof = {
      kind: 'command', scope, argv: input.argv, cwd: input.cwd ?? '.', artifact: file.path, artifactHash: file.hash,
      exitCode, stable: before.sha256 === after.sha256, fingerprint: after.sha256, headSha: after.headSha,
    };
    const next = append(slug, state, { type: 'proof_recorded', proof }).state;
    return ok({ artifact: file.path, exitCode, stable: proof.stable, revision: next.revision, fingerprint: after.sha256 });
  }
  if (verb === 'evidence') {
    const scope = requireScope(input, state);
    if (scope !== 'final') {
      const goal = state.goals.find((item) => item.id === scope);
      if (goal.kind !== 'report') fail('evidence is only valid for report goals');
    } else if (state.goals.some((goal) => goal.kind === 'change')) fail('final report evidence is valid only when every goal is report-only');
    if (typeof input.summary !== 'string' || !input.summary.trim()) fail('evidence summary is required');
    if (!Array.isArray(input.acceptance) || input.acceptance.length === 0 || input.acceptance.some((item) => typeof item !== 'string' || !item.trim())) fail('evidence acceptance must be non-empty');
    const fingerprint = workspaceFingerprint();
    const data = { schemaVersion: SCHEMA_VERSION, kind: 'report', scope, summary: input.summary, acceptance: input.acceptance, fingerprint: fingerprint.sha256, headSha: fingerprint.headSha, createdAt: new Date().toISOString() };
    const file = artifact(slug, 'report', data);
    const proof = { kind: 'report', scope, artifact: file.path, artifactHash: file.hash, fingerprint: fingerprint.sha256, headSha: fingerprint.headSha };
    const next = append(slug, state, { type: 'proof_recorded', proof }).state;
    return ok({ artifact: file.path, revision: next.revision, fingerprint: fingerprint.sha256 });
  }
  if (verb === 'review') {
    const scope = requireScope(input, state);
    if (typeof input.reviewer !== 'string' || !input.reviewer.trim() || !['pass', 'fail'].includes(input.verdict) || typeof input.summary !== 'string' || !input.summary.trim()) fail('review requires reviewer, pass|fail verdict, and summary');
    const fingerprint = workspaceFingerprint();
    const data = { schemaVersion: SCHEMA_VERSION, kind: 'review', scope, reviewer: input.reviewer, verdict: input.verdict, summary: input.summary, fingerprint: fingerprint.sha256, headSha: fingerprint.headSha, createdAt: new Date().toISOString() };
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
    const proofKind = goal.kind === 'change' ? 'command' : 'report';
    const proof = eligibleProof(state, goal.id, fingerprint, proofKind);
    if (!proof) fail(`missing, failed, or stale ${proofKind} proof for ${goal.id}`);
    const review = latestReview(state, goal.id, fingerprint);
    if (!review || review.verdict !== 'pass') fail(`missing, failed, or stale independent review pass for ${goal.id}`);
    if (!validAcceptanceEvidence(goal, input.acceptanceEvidence)) fail('acceptanceEvidence must provide ordered {criterion,evidence} entries matching every acceptance criterion');
    const completion = { fingerprint, proofArtifact: proof.artifact, reviewArtifact: review.artifact, acceptanceEvidence: input.acceptanceEvidence };
    const next = append(slug, state, { type: 'goal_completed', goalId: goal.id, completion }).state;
    return ok({ goalId: goal.id, status: 'complete', revision: next.revision });
  }
  if (verb === 'close') {
    const incomplete = state.goals.filter((goal) => goal.status !== 'complete');
    if (incomplete.length) fail(`cannot close with incomplete goals: ${incomplete.map((goal) => goal.id).join(', ')}`);
    const fingerprint = workspaceFingerprint();
    const proofKind = state.goals.some((goal) => goal.kind === 'change') ? 'command' : 'report';
    const finalProof = eligibleProof(state, 'final', fingerprint.sha256, proofKind);
    if (!finalProof) fail('missing, failed, or stale final proof for current workspace fingerprint');
    if (latestReview(state, 'final', fingerprint.sha256)?.verdict !== 'pass') fail('missing, failed, or stale final independent review pass');
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
    const next = append(slug, state, { type: 'plan_closed', fingerprint: fingerprint.sha256 }).state;
    return ok({ closed: slug, revision: next.revision });
  }
  fail(`unknown verb: ${verb}`);
}

function main() {
  const [verb, ...args] = process.argv.slice(2);
  const slugIndex = args.indexOf('--slug');
  const slug = requireSlug(slugIndex >= 0 ? args[slugIndex + 1] : undefined);
  if (verb === 'status') {
    const { state, snapshotStatus } = load(slug, { tolerateSnapshot: true });
    return ok({ ...state, snapshotStatus });
  }
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
