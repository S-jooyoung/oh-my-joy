#!/usr/bin/env node
/**
 * goal-state — the only mutation path for `.omj/goals/<slug>/` durable state.
 *
 * `/oh-my-joy:goal-loop` pre-approves only calls to this script — no Write/Edit.
 * So "passing this validator", not "saying it is done", becomes the definition of
 * completion: invalid transitions, complete without evidence, and truncated
 * ledgers are all rejected with a non-zero exit.
 *
 * Contract: `goals.json` (snapshot) is the canonical current state; `ledger.jsonl`
 * (append-only) is the proof stream. The snapshot is replaced atomically via
 * temp→rename, and snapshot/ledger-tail agreement is checked before every
 * mutation — a mismatch stops with "reconcile first".
 * Concurrent writers are unsupported (single-owner sequential loop premise).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCHEMA_VERSION = 1;

export const GOAL_STATUSES = ['pending', 'active', 'complete', 'blocked', 'failed'];

/** Valid-transition table — any transition not listed here is rejected. */
export const TRANSITIONS = {
  pending: ['active'],
  active: ['complete', 'blocked', 'failed'],
  blocked: ['active'],
  complete: [],
  failed: ['active'],
};

/** Ledger event vocabulary — bound to the examples in commands/goal-loop.md by a drift test. */
export const EVENTS = [
  'plan_created',
  'goal_added',
  'goal_started',
  'goal_resumed',
  'goal_completed',
  'goal_blocked',
  'goal_failed',
  'plan_closed',
];

const TRANSITION_EVENT = {
  'pending>active': 'goal_started',
  'blocked>active': 'goal_resumed',
  'failed>active': 'goal_resumed',
  'active>complete': 'goal_completed',
  'active>blocked': 'goal_blocked',
  'active>failed': 'goal_failed',
};

/** Evidence requirements for a complete transition — without them, completion does not exist. */
export function validateEvidence(evidence) {
  const v = evidence?.verification;
  if (!v || typeof v !== 'object') return 'evidence.verification object is required';
  if (!['passed', 'verified'].includes(v.status)) return "verification.status must be 'passed'|'verified'";
  if (!Array.isArray(v.commands) || v.commands.length === 0 || v.commands.some((c) => !c?.trim())) {
    return 'verification.commands must be a non-empty list of commands';
  }
  if (typeof v.evidence !== 'string' || !v.evidence.trim()) return 'verification.evidence summary is required';
  return null;
}

const fail = (message) => {
  process.stderr.write(`goal-state: ${message}\n`);
  process.exit(1);
};

const goalsRoot = (slug) => path.join(process.cwd(), '.omj', 'goals', slug);
const snapshotPath = (slug) => path.join(goalsRoot(slug), 'goals.json');
const ledgerPath = (slug) => path.join(goalsRoot(slug), 'ledger.jsonl');

const readLedger = (slug) => {
  const raw = existsSync(ledgerPath(slug)) ? readFileSync(ledgerPath(slug), 'utf8') : '';
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        fail(`ledger line ${index + 1} is not JSON — a corrupted ledger requires manual recovery`);
      }
    });
};

/** Re-derive snapshot state from the ledger — the shared heart of reconcile and validate. */
function deriveFromLedger(events) {
  const goals = new Map();
  let closed = false;
  for (const event of events) {
    if (event.event === 'plan_created' || event.event === 'goal_added') {
      for (const goal of event.goals ?? []) {
        goals.set(goal.id, { ...goal, status: 'pending', evidence: null, reason: null });
      }
    } else if (event.event === 'plan_closed') {
      closed = true;
    } else if (event.goal_id) {
      const goal = goals.get(event.goal_id);
      if (!goal) continue;
      if (event.event === 'goal_started' || event.event === 'goal_resumed') goal.status = 'active';
      if (event.event === 'goal_completed') {
        goal.status = 'complete';
        goal.evidence = event.evidence ?? null;
      }
      if (event.event === 'goal_blocked') {
        goal.status = 'blocked';
        goal.reason = event.reason ?? null;
      }
      if (event.event === 'goal_failed') {
        goal.status = 'failed';
        goal.reason = event.reason ?? null;
      }
    }
  }
  return { goals, closed };
}

function integrityErrors(snapshot, events) {
  const errors = [];
  if (snapshot.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version ${snapshot.schema_version} — supported version is ${SCHEMA_VERSION}`);
  }
  events.forEach((event, index) => {
    if (event.seq !== index + 1) errors.push(`ledger seq is not monotonically increasing: line ${index + 1} has seq=${event.seq}`);
    if (!EVENTS.includes(event.event)) errors.push(`unknown event: ${event.event}`);
  });
  const tail = events.length;
  if (snapshot.last_event_id > tail) {
    errors.push(`ledger is truncated — snapshot last_event_id=${snapshot.last_event_id}, ledger tail=${tail}. append-only violated`);
  }
  if (snapshot.last_event_id < tail) {
    errors.push(`snapshot is behind — re-derive it from the ledger with reconcile`);
  }
  const derived = deriveFromLedger(events);
  for (const goal of snapshot.goals) {
    if (!GOAL_STATUSES.includes(goal.status)) errors.push(`${goal.id}: unknown status ${goal.status}`);
    const expected = derived.goals.get(goal.id);
    if (expected && snapshot.last_event_id === tail && expected.status !== goal.status) {
      errors.push(`${goal.id}: snapshot (${goal.status}) and ledger-derived status (${expected.status}) disagree`);
    }
  }
  return errors;
}

function loadState(slug) {
  if (!existsSync(snapshotPath(slug))) fail(`.omj/goals/${slug}/goals.json not found — run init first`);
  const snapshot = JSON.parse(readFileSync(snapshotPath(slug), 'utf8'));
  const events = readLedger(slug);
  const errors = integrityErrors(snapshot, events);
  if (errors.length > 0) fail(`integrity check failed:\n- ${errors.join('\n- ')}`);
  return { snapshot, events };
}

// The dir parameter routes init through its temp directory — serialization and stamping
// must stay in these two functions so init cannot clone the format and silently drift.
function writeSnapshot(slug, snapshot, dir = goalsRoot(slug)) {
  const target = path.join(dir, 'goals.json');
  const temp = `${target}.tmp`;
  snapshot.updated_at = new Date().toISOString();
  writeFileSync(temp, `${JSON.stringify(snapshot, null, 2)}\n`);
  renameSync(temp, target); // atomic replacement — no half-written snapshot survives an interruption
}

function appendEvent(slug, snapshot, event, dir = goalsRoot(slug)) {
  const entry = { seq: snapshot.last_event_id + 1, ts: new Date().toISOString(), ...event };
  appendFileSync(path.join(dir, 'ledger.jsonl'), `${JSON.stringify(entry)}\n`);
  snapshot.last_event_id = entry.seq;
  return entry;
}

const ok = (payload) => process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

// A value-less flag (bare --reason) makes parseArgs store true — narrow before string
// checks so the intended error message goes out instead of a stack trace.
const str = (value) => (typeof value === 'string' ? value : '');

// The slug becomes a path segment — every entry point (main·reconcile) must pass the same
// validation so `../../x`-style traversal cannot hide under pre-approved Bash rules (PRINCIPLES ③).
function requireSlug(args) {
  const slug = str(args.slug);
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail('--slug allows lowercase letters, digits, and hyphens only');
  return slug;
}

const normalizeGoals = (raw, startIndex = 0) =>
  raw.map((goal, index) => {
    if (!str(goal.title).trim() || !str(goal.objective).trim()) fail('each goal requires a title and an objective');
    return { id: goal.id ?? `G${String(startIndex + index + 1).padStart(3, '0')}`, title: goal.title, objective: goal.objective };
  });

function main() {
  const [verb, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (!verb) fail('usage: goal-state.mjs <init|transition|add-goal|close|status|validate|reconcile> --slug <slug> …');
  const slug = requireSlug(args);

  if (verb === 'init') {
    if (existsSync(goalsRoot(slug))) fail(`.omj/goals/${slug}/ already exists — resume with status/reconcile, or init a new plan under a different slug`);
    const briefFile = str(args['brief-file']);
    // Relative paths inside the repo only — absolute paths and traversal become arbitrary file
    // reads hiding under pre-approved rules. POSIX and win32 checks must run together so
    // C:\…, C:/…, and \\UNC\… drive-absolute paths cannot slip past the guard.
    if (
      briefFile &&
      (path.isAbsolute(briefFile) || path.win32.isAbsolute(briefFile) || briefFile.split(/[\\/]/).includes('..'))
    ) {
      fail('--brief-file must be a relative path inside the repo (no absolute paths, no ..)');
    }
    const brief = briefFile ? readFileSync(briefFile, 'utf8') : str(args.brief);
    if (!brief.trim()) fail('--brief or --brief-file is required');
    let goals;
    try {
      goals = normalizeGoals(JSON.parse(args['goals-json'] ?? '[]'));
    } catch (error) {
      fail(`--goals-json parse failure: ${error.message}`);
    }
    if (goals.length === 0) fail('at least one goal is required');

    const snapshot = {
      schema_version: SCHEMA_VERSION,
      slug,
      closed: false,
      created_at: new Date().toISOString(),
      updated_at: null,
      last_event_id: 0,
      goals: goals.map((goal) => ({ ...goal, status: 'pending', evidence: null, reason: null })),
    };
    // Build in a temp directory, then rename — writing step by step at the final path leaves
    // crash debris that occupies it, putting init ("already exists"), the other verbs, and
    // reconcile ("run init first") all in refusal: an unrecoverable state (this extends
    // writeSnapshot's atomic-replacement contract to init as a whole).
    const goalsParent = path.dirname(goalsRoot(slug));
    if (existsSync(goalsParent)) {
      // Also clean crash debris left by other pids — keeps it from piling up silently under gitignore.
      for (const entry of readdirSync(goalsParent)) {
        if (entry.startsWith(`${slug}.tmp-`)) rmSync(path.join(goalsParent, entry), { recursive: true, force: true });
      }
    }
    const tmpRoot = `${goalsRoot(slug)}.tmp-${process.pid}`;
    try {
      mkdirSync(tmpRoot, { recursive: true });
      writeFileSync(path.join(tmpRoot, 'brief.md'), brief);
      writeFileSync(path.join(tmpRoot, 'ledger.jsonl'), '');
      appendEvent(slug, snapshot, { event: 'plan_created', goals }, tmpRoot);
      writeSnapshot(slug, snapshot, tmpRoot);
      renameSync(tmpRoot, goalsRoot(slug));
    } catch (error) {
      rmSync(tmpRoot, { recursive: true, force: true });
      throw error;
    }
    return ok({ initialized: slug, goals: snapshot.goals.map((g) => ({ id: g.id, title: g.title, status: g.status })) });
  }

  const { snapshot } = loadState(slug);

  if (verb === 'status') {
    return ok(snapshot);
  }

  if (verb === 'validate') {
    return ok({ valid: true, slug, goals: snapshot.goals.length, last_event_id: snapshot.last_event_id, closed: snapshot.closed });
  }

  if (snapshot.closed) fail('plan is already closed — init a new slug');

  if (verb === 'transition') {
    const goal = snapshot.goals.find((g) => g.id === args.goal);
    if (!goal) fail(`goal ${args.goal} not found`);
    const to = args.to;
    if (!GOAL_STATUSES.includes(to)) fail(`unknown status: ${to}`);
    if (!TRANSITIONS[goal.status].includes(to)) {
      fail(`invalid transition: ${goal.id} ${goal.status} → ${to} (allowed: ${TRANSITIONS[goal.status].join(', ') || 'none'})`);
    }
    if (to === 'active') {
      const active = snapshot.goals.find((g) => g.status === 'active');
      if (active) fail(`single-owner rule: ${active.id} is already active — transition it to complete/blocked/failed first`);
    }
    let evidence = null;
    if (to === 'complete') {
      try {
        evidence = JSON.parse(args['evidence-json'] ?? 'null');
      } catch (error) {
        fail(`--evidence-json parse failure: ${error.message}`);
      }
      const evidenceError = validateEvidence(evidence);
      if (evidenceError) fail(`insufficient evidence — ${evidenceError}. Completion does not exist without an evidence object`);
    }
    if ((to === 'blocked' || to === 'failed') && !str(args.reason).trim()) fail(`a ${to} transition requires --reason`);

    const event = appendEvent(slug, snapshot, {
      event: TRANSITION_EVENT[`${goal.status}>${to}`],
      goal_id: goal.id,
      ...(evidence ? { evidence } : {}),
      ...(str(args.reason) ? { reason: str(args.reason) } : {}),
    });
    goal.status = to;
    if (evidence) goal.evidence = evidence;
    if (str(args.reason)) goal.reason = str(args.reason);
    writeSnapshot(slug, snapshot);
    return ok({ transitioned: goal.id, to, seq: event.seq });
  }

  if (verb === 'add-goal') {
    const [goal] = normalizeGoals([{ title: args.title, objective: args.objective }], snapshot.goals.length);
    if (snapshot.goals.some((g) => g.id === goal.id)) fail(`goal id collision: ${goal.id}`);
    appendEvent(slug, snapshot, { event: 'goal_added', goals: [goal] });
    snapshot.goals.push({ ...goal, status: 'pending', evidence: null, reason: null });
    writeSnapshot(slug, snapshot);
    return ok({ added: goal.id, title: goal.title });
  }

  if (verb === 'close') {
    const incomplete = snapshot.goals.filter((g) => g.status !== 'complete' || validateEvidence(g.evidence) !== null);
    if (incomplete.length > 0) {
      fail(`cannot close — goals not complete with evidence: ${incomplete.map((g) => `${g.id}(${g.status})`).join(', ')}`);
    }
    appendEvent(slug, snapshot, { event: 'plan_closed' });
    snapshot.closed = true;
    writeSnapshot(slug, snapshot);
    return ok({ closed: slug, goals: snapshot.goals.length });
  }

  fail(`unknown verb: ${verb}`);
}

/** reconcile must operate ahead of the integrity gate, so it has its own entry point. */
function reconcileMain(slug) {
  if (!existsSync(snapshotPath(slug))) fail(`.omj/goals/${slug}/goals.json not found — run init first`);
  const snapshot = JSON.parse(readFileSync(snapshotPath(slug), 'utf8'));
  const events = readLedger(slug);
  if (snapshot.last_event_id > events.length) {
    fail(`ledger is shorter than the snapshot (truncated) — lost events cannot be re-derived. Restore the ledger from a backup`);
  }
  const derived = deriveFromLedger(events);
  snapshot.goals = snapshot.goals.map((goal) => {
    const expected = derived.goals.get(goal.id);
    return expected ? { ...goal, status: expected.status, evidence: expected.evidence, reason: expected.reason } : goal;
  });
  for (const [id, goal] of derived.goals) {
    if (!snapshot.goals.some((g) => g.id === id)) {
      snapshot.goals.push({ id, title: goal.title, objective: goal.objective, status: goal.status, evidence: goal.evidence, reason: goal.reason });
    }
  }
  snapshot.closed = derived.closed;
  snapshot.last_event_id = events.length;
  writeSnapshot(slug, snapshot);
  ok({ reconciled: slug, last_event_id: snapshot.last_event_id });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [verb, ...rest] = process.argv.slice(2);
  if (verb === 'reconcile') {
    reconcileMain(requireSlug(parseArgs(rest)));
  } else {
    main();
  }
}
