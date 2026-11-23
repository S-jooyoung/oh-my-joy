#!/usr/bin/env node
/** Durable, provider-neutral state and evidence helper for OMJ ultragoal. */
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { hostname, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

export const SCHEMA_VERSION = 3;
const SUPPORTED_SCHEMA_VERSIONS = new Set([2, 3]);
export const GOAL_STATUSES = ['pending', 'active', 'complete', 'blocked'];
const GOAL_KINDS = ['change', 'report'];
const EVENT_TYPES = new Set([
  'initialized', 'goal_started', 'goal_resumed', 'goal_blocked', 'proof_recorded',
  'review_recorded', 'goal_completed', 'final_resumed', 'plan_closed',
]);
const REMOVED_EVENTS = new Map([['trial_recorded', 'trial events'], ['finding_dispositioned', 'finding events'], ['delivery_recorded', 'delivery events']]);
const VERBS = new Set(['init', 'status', 'start', 'resume', 'block', 'verify', 'evidence', 'review', 'complete', 'close', 'reconcile']);
const REVIEW_FAIL_LIMIT = 3;
const SELF = fileURLToPath(import.meta.url);
const VERIFY_TAIL = 1_000_000;
const EXCERPT_LINES = 20;
const EXCERPT_CHARS = 2_000;

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

// OMJ configuration lives as files directly in .omj/ (fe-context.md and its
// siblings); its subdirectories hold generated state. A project or global ignore
// rule can hide .omj/ from `git ls-files --others`, so untracked config files are
// added here by name, or a verifyCommands edit would leave the fingerprint unchanged.
function omjConfigFiles(top) {
  const dir = path.join(top, '.omj');
  if (!existsSync(dir)) return [];
  const tracked = new Set(git(['ls-files', '-z', '--', ':(top).omj']).stdout.split('\0').filter(Boolean));
  return readdirSync(dir, { withFileTypes: true })
    // Dotfiles and `~` backups are editor and OS leftovers (.DS_Store, .fe-context.md.swp, .#fe-context.md), not config.
    .filter((entry) => !entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.endsWith('~'))
    .map((entry) => `.omj/${entry.name}`)
    .filter((file) => !tracked.has(file));
}

export function workspaceFingerprint() {
  const top = projectRoot();
  const headResult = git(['rev-parse', 'HEAD'], { allowFailure: true });
  const headSha = headResult.status === 0 ? headResult.stdout.trim() : null;
  const stateExcluded = ['--', ':(top)**', ':(top,exclude).omj/goals/**'];
  const diff = headSha ? git(['diff', '--binary', 'HEAD', ...stateExcluded]).stdout : '';
  const staged = git(['diff', '--cached', '--binary', ...stateExcluded]).stdout;
  const listed = git(['ls-files', '--others', '--exclude-standard', '-z']).stdout
    .split('\0')
    .filter((file) => file && !file.startsWith('.omj/goals/'));
  const untracked = [...new Set([...listed, ...omjConfigFiles(top)])].sort();
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

function removedFeature(event) {
  if (event.type !== 'initialized') return REMOVED_EVENTS.get(event.type) ?? null;
  if (Array.isArray(event.goals) && event.goals.some((goal) => goal?.kind === 'experiment')) return 'experiment goals';
  if (event.pr != null) return 'a PR contract';
  if (event.crossReview?.mode === 'required') return 'crossReview mode required';
  return null;
}

function readLedger(slug) {
  if (!existsSync(ledgerFor(slug))) fail(`.omj/goals/${slug}/ledger.jsonl not found — run init first`);
  const raw = readFileSync(ledgerFor(slug), 'utf8');
  if (raw && !raw.endsWith('\n')) fail('ledger is truncated — final event has no newline');
  const events = raw.split('\n').filter(Boolean).map((line, index) => {
    let event;
    try { event = JSON.parse(line); } catch { fail(`ledger line ${index + 1} is corrupt JSON`); }
    if (event.seq !== index + 1) fail(`ledger seq mismatch at line ${index + 1}`);
    return event;
  });
  const removed = events.map(removedFeature).find(Boolean);
  if (removed) fail(`this ledger uses ${removed}, removed in 2.0 — finish it with oh-my-joy 1.5.x`);
  events.forEach((event, index) => {
    if (!EVENT_TYPES.has(event.type)) fail(`ledger line ${index + 1} has unknown event type`);
  });
  return events;
}

function initialState(event) {
  return {
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
    // pr, findings, and delivery stay at their empty values so snapshots written by 1.5 still match.
    pr: null,
    ...(event.crossReview ? { crossReview: event.crossReview } : {}),
    findings: {},
    delivery: null,
  };
}

const proofKindFor = (goal) => (goal.kind === 'report' ? 'report' : 'command');
const finalProofKind = (state) => (state.goals.some((goal) => goal.kind !== 'report') ? 'command' : 'report');

// A goal's window opens at its last start or resume; the final window opens once every goal
// is complete and again at each final resume.
function failedReviews(events, scope) {
  const resets = scope === 'final' ? ['goal_completed', 'final_resumed'] : ['goal_started', 'goal_resumed'];
  const since = events.findLast((event) => resets.includes(event.type) && (scope === 'final' || event.goalId === scope))?.seq ?? 0;
  return events.filter((event) => event.seq > since && event.type === 'review_recorded' && event.review?.scope === scope && event.review.verdict === 'fail').length;
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
      if (state.crossReview && !crossReviewSatisfied(state.crossReview, review, Boolean(review.outputHash))) fail(`review at seq ${event.seq} is neither a cross-host review nor a recorded fallback`);
      if (review.scope !== 'final' && !state.goals.some((item) => item.id === review.scope)) fail(`review at seq ${event.seq} has unknown scope`);
      if (review.scope === 'final' ? state.goals.some((item) => item.status !== 'complete') : state.goals.find((item) => item.id === review.scope).status !== 'active') fail(`review at seq ${event.seq} is out of sequence`);
      state.reviews.push(review);
    } else if (event.type === 'goal_completed') {
      if (goal.status !== 'active' || !event.completion) fail(`illegal goal_completed event at seq ${event.seq}`);
      const proof = eligibleProof(state, goal.id, event.completion.fingerprint, proofKindFor(goal));
      const review = latestReview(state, goal.id, event.completion.fingerprint);
      if (!proof || review?.verdict !== 'pass' || proof.artifact !== event.completion.proofArtifact || review.artifact !== event.completion.reviewArtifact) fail(`goal_completed at seq ${event.seq} lacks matching proof/review`);
      if (!validAcceptanceEvidence(goal, event.completion.acceptanceEvidence)) fail(`goal_completed at seq ${event.seq} lacks acceptance evidence`);
      goal.status = 'complete';
      goal.completion = event.completion;
    } else if (event.type === 'final_resumed') {
      const earlier = events.filter((item) => item.seq < event.seq);
      if (state.goals.some((item) => item.status !== 'complete') || failedReviews(earlier, 'final') < REVIEW_FAIL_LIMIT) fail(`illegal final_resumed event at seq ${event.seq}`);
    } else if (event.type === 'plan_closed') {
      if (state.goals.some((item) => item.status !== 'complete')) fail(`plan_closed at seq ${event.seq} has incomplete goals`);
      const finalProof = eligibleProof(state, 'final', event.fingerprint, finalProofKind(state));
      if (!finalProof || !finalReviewSatisfied(state, event)) fail(`plan_closed at seq ${event.seq} lacks final proof/review`);
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
  const expectedPlanHash = sha256(canonical({ brief, goals: events[0].goals, pr: events[0].pr ?? null, ...(events[0].crossReview ? { crossReview: events[0].crossReview } : {}) }));
  if (state.planHash !== expectedPlanHash) fail('approved plan hash mismatch — brief or initialization ledger was modified');
  if (canonical(state.identity) !== canonical(repoIdentity())) fail('repository/worktree identity does not match the initialized plan');
  for (const receipt of [...state.proofs, ...state.reviews]) validateArtifact(slug, receipt);
  for (const review of state.reviews) validateReviewOutput(slug, review);
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
    if (!GOAL_KINDS.includes(goal.kind)) fail(`${id} kind must be change or report`);
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

// A cross-host reviewer writes its own output file; the author only names the path.
// Hashing it here is what lets a later reader tell the reviewer's words from the author's summary.
const HOST_NAME = /^[a-z][a-z0-9-]{0,31}$/;
const REVIEW_OUTPUT = /^reviews\/[A-Za-z0-9._-]+$/;

function reviewOutputReceipt(slug, output) {
  if (typeof output !== 'string' || !REVIEW_OUTPUT.test(output)) fail('review output must be a file path under reviews/');
  const target = path.join(rootFor(slug), output);
  if (!existsSync(target) || !statSync(target).isFile() || statSync(target).size === 0) fail(`review output missing or empty: ${output}`);
  return { output, outputHash: sha256(readFileSync(target)) };
}

function validateReviewOutput(slug, review) {
  if (review.output === undefined) return;
  const target = path.join(rootFor(slug), review.output);
  if (!REVIEW_OUTPUT.test(review.output) || !existsSync(target) || sha256(readFileSync(target)) !== review.outputHash) fail(`review output missing or tampered: ${review.output}`);
}

function validateCrossReview(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value) || !HOST_NAME.test(value.authorHost ?? '') || value.mode !== 'preferred' || Object.keys(value).length !== 2) fail('crossReview must be {authorHost, mode} with a lowercase host name and mode preferred');
  return { authorHost: value.authorHost, mode: value.mode };
}

// A review counts when another host wrote it, or when the author records why the other
// host could not run. The second kind stays visible in the ledger, so a same-host reading
// is never mistaken for a cross-host one.
function crossReviewSatisfied(cross, review, hasOutput) {
  const author = review.authorHost ?? cross.authorHost;
  const crossHost = hasOutput && HOST_NAME.test(review.reviewerHost ?? '') && review.reviewerHost !== author;
  const fallback = typeof review.fallbackReason === 'string' && review.fallbackReason.trim() !== '';
  return crossHost ? review.fallbackReason === undefined : fallback;
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

const outputExcerpt = (text) =>
  stripVTControlCharacters(text).replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim()).slice(-EXCERPT_LINES).join('\n').slice(-EXCERPT_CHARS);

function runCommand(argv, cwd, { timeoutSeconds = null } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'omj-run-'));
  try {
    const spec = {
      argv,
      cwd: safeCwd(cwd),
      timeoutMs: timeoutSeconds ? timeoutSeconds * 1000 : null,
      stdoutPath: path.join(dir, 'stdout'),
      stderrPath: path.join(dir, 'stderr'),
      resultPath: path.join(dir, 'result.json'),
    };
    writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec));
    const runner = spawnSync(process.execPath, [SELF, '__run', path.join(dir, 'spec.json')], { stdio: 'ignore' });
    const result = existsSync(spec.resultPath)
      ? JSON.parse(readFileSync(spec.resultPath, 'utf8'))
      : { exitCode: 1, signal: runner.signal ?? null, timedOut: false, error: 'runner produced no result' };
    return {
      exitCode: result.exitCode,
      signal: result.signal ?? null,
      timedOut: result.timedOut === true,
      error: result.error ?? null,
      stdout: readTail(spec.stdoutPath, VERIFY_TAIL),
      stderr: readTail(spec.stderrPath, VERIFY_TAIL),
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

function reuseProof(slug, state, scope, input) {
  if (scope !== 'final') fail('reuse is only valid for final scope');
  if (state.schemaVersion < 3) fail('reuse requires a schema v3 ledger');
  safeCwd(input.cwd);
  const cwd = input.cwd ?? '.';
  const key = canonical({ argv: input.argv, cwd });
  const fingerprint = workspaceFingerprint();
  const candidates = state.proofs.filter((proof) => proof.kind === 'command' && proof.fingerprint === fingerprint.sha256 && canonical({ argv: proof.argv, cwd: proof.cwd }) === key);
  if (!candidates.length || candidates.some((proof) => proof.exitCode !== 0 || !proof.stable)) fail('no stable pass of this command on the current fingerprint');
  const source = candidates.at(-1);
  const proof = {
    kind: 'command', scope, argv: input.argv, cwd, artifact: source.artifact, artifactHash: source.artifactHash,
    exitCode: source.exitCode, stable: source.stable, fingerprint: fingerprint.sha256, headSha: source.headSha, reused: true,
  };
  const next = append(slug, state, { type: 'proof_recorded', proof }).state;
  return ok({ artifact: proof.artifact, exitCode: proof.exitCode, stable: proof.stable, timedOut: false, revision: next.revision, fingerprint: proof.fingerprint, reused: true });
}

function init(slug, input) {
  if (existsSync(rootFor(slug))) {
    if (existsSync(ledgerFor(slug))) readLedger(slug);
    fail(`.omj/goals/${slug}/ already exists`);
  }
  if (typeof input.brief !== 'string' || !input.brief.trim()) fail('brief is required');
  if (input.pr != null) fail('pr was removed in 2.0');
  const brief = input.brief.endsWith('\n') ? input.brief : `${input.brief}\n`;
  const goals = validateGoals(input.goals);
  const crossReview = validateCrossReview(input.crossReview);
  const identity = repoIdentity();
  const initialFingerprint = workspaceFingerprint();
  const planHash = sha256(canonical({ brief, goals, pr: null, ...(crossReview ? { crossReview } : {}) }));
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
    pr: null,
    ...(crossReview ? { crossReview } : {}),
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
  const { events, state } = load(slug, { tolerateSnapshot: verb === 'reconcile' });
  requireRevision(input, state);
  if (verb === 'reconcile') {
    writeSnapshot(slug, state);
    return ok({ reconciled: slug, revision: state.revision });
  }
  if (state.closed) fail('plan is already closed');
  if (verb === 'resume' && input.scope === 'final') {
    if (state.goals.some((goal) => goal.status !== 'complete')) fail('final resume requires every goal complete');
    if (failedReviews(events, 'final') < REVIEW_FAIL_LIMIT) fail('final resume requires three failed final reviews since the final audit last opened');
    const result = append(slug, state, { type: 'final_resumed' });
    return ok({ scope: 'final', revision: result.state.revision });
  }
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
    validateArgv(input.argv);
    const timeoutSeconds = optionalTimeout(input.timeoutSeconds);
    if (input.reuse != null && typeof input.reuse !== 'boolean') fail('reuse must be a boolean');
    if (input.reuse === true) return reuseProof(slug, state, scope, input);
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
    return ok({
      artifact: file.path, exitCode: run.exitCode, stable: proof.stable, timedOut: run.timedOut, revision: next.revision, fingerprint: after.sha256, reused: false,
      excerpt: { stdout: outputExcerpt(run.stdout), stderr: outputExcerpt(run.stderr) }, ...(run.error ? { error: run.error.slice(0, 500) } : {}),
    });
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
    if (failedReviews(events, scope) >= REVIEW_FAIL_LIMIT) {
      fail(scope === 'final' ? 'review has failed three times — stop and report with the ledger open' : 'review has failed three times — block the goal');
    }
    if (typeof input.reviewer !== 'string' || !input.reviewer.trim() || !['pass', 'fail'].includes(input.verdict) || typeof input.summary !== 'string' || !input.summary.trim()) fail('review requires reviewer, pass|fail verdict, and summary');
    const cross = state.crossReview;
    for (const key of ['reviewerHost', 'authorHost']) {
      if (input[key] !== undefined && !HOST_NAME.test(typeof input[key] === 'string' ? input[key] : '')) fail(`${key} must be a lowercase host name`);
    }
    if (input.fallbackReason !== undefined && (typeof input.fallbackReason !== 'string' || !input.fallbackReason.trim())) fail('fallbackReason must be a non-empty string');
    if (cross && !crossReviewSatisfied(cross, input, input.output !== undefined)) {
      fail(`cross-host review is preferred: record reviewerHost (not ${input.authorHost ?? cross.authorHost}) with output, or fallbackReason alone for a same-host review`);
    }
    const reviewOutput = {
      ...(input.authorHost !== undefined ? { authorHost: input.authorHost } : {}),
      ...(input.reviewerHost !== undefined ? { reviewerHost: input.reviewerHost } : {}),
      ...(input.output !== undefined ? reviewOutputReceipt(slug, input.output) : {}),
      ...(input.fallbackReason !== undefined ? { fallbackReason: input.fallbackReason } : {}),
    };
    const fingerprint = workspaceFingerprint();
    const data = { schemaVersion: state.schemaVersion, kind: 'review', scope, reviewer: input.reviewer, verdict: input.verdict, summary: input.summary, ...reviewOutput, fingerprint: fingerprint.sha256, headSha: fingerprint.headSha, createdAt: new Date().toISOString() };
    const file = artifact(slug, 'review', data);
    const review = { ...data, artifact: file.path, artifactHash: file.hash };
    const next = append(slug, state, { type: 'review_recorded', review }).state;
    return ok({ artifact: file.path, verdict: review.verdict, revision: next.revision, fingerprint: fingerprint.sha256 });
  }
  if (verb === 'complete') {
    const goal = state.goals.find((item) => item.id === input.goalId);
    if (!goal || goal.status !== 'active') fail('complete requires an active goal');
    const fingerprint = workspaceFingerprint().sha256;
    const proofKind = proofKindFor(goal);
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
    const event = { type: 'plan_closed', fingerprint: fingerprint.sha256 };
    if (state.schemaVersion >= 3) event.finalReview = finalReviewRecord;
    const next = append(slug, state, event).state;
    return ok({ closed: slug, revision: next.revision, finalReview: finalReviewRecord });
  }
  fail(`unknown verb: ${verb}`);
}

function status(slug) {
  if (!existsSync(ledgerFor(slug))) return ok({ exists: false, slug });
  const { state, snapshotStatus } = load(slug, { tolerateSnapshot: true });
  return ok({ ...state, snapshotStatus, flakyChecks: flakyChecks(state) });
}

function main() {
  const [verb, ...args] = process.argv.slice(2);
  if (verb === '__run') return runnerMain(args[0]);
  if (!VERBS.has(verb)) fail(`unknown verb: ${verb}`);
  const slugIndex = args.indexOf('--slug');
  const slug = requireSlug(slugIndex >= 0 ? args[slugIndex + 1] : undefined);
  if (verb === 'status') return status(slug);
  const input = readInput();
  return withLock(slug, () => verb === 'init' ? init(slug, input) : mutate(slug, verb, input));
}

function invokedDirectly() {
  try { return realpathSync(process.argv[1]) === realpathSync(SELF); } catch { return false; }
}

if (invokedDirectly()) {
  try { main(); } catch (error) {
    if (error.message !== '__goal_state_failure__') {
      process.stderr.write(`goal-state: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
