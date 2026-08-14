#!/usr/bin/env node
/**
 * goal-state — `.omj/goals/<slug>/` durable 상태의 유일한 변경 경로.
 *
 * `/oh-my-joy:goal-loop`는 Write/Edit 없이 이 스크립트 호출만 사전승인받는다.
 * 그래서 "완료했다고 말하기"가 아니라 "이 검증기를 통과시키기"가 완료의 정의가 된다:
 * 유효하지 않은 전이, 증거 없는 complete, 잘린 ledger는 전부 non-zero로 거부된다.
 *
 * 계약: `goals.json`(스냅샷)이 현재 상태의 정본, `ledger.jsonl`(append-only)이 증명
 * 스트림이다. 스냅샷은 temp→rename으로 원자적으로 교체되고, 매 변경 전에 스냅샷과
 * ledger 꼬리의 일치를 검사한다 — 불일치는 "reconcile 먼저"로 멈춘다.
 * 동시 writer는 지원하지 않는다(단일 owner 순차 루프 전제).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCHEMA_VERSION = 1;

export const GOAL_STATUSES = ['pending', 'active', 'complete', 'blocked', 'failed'];

/** 유효 전이표 — 여기 없는 전이는 전부 거부된다. */
export const TRANSITIONS = {
  pending: ['active'],
  active: ['complete', 'blocked', 'failed'],
  blocked: ['active'],
  complete: [],
  failed: ['active'],
};

/** ledger 이벤트 어휘 — commands/goal-loop.md의 예시와 드리프트 테스트로 묶인다. */
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

/** complete 전이의 증거 필수조건 — 없으면 완료 자체가 성립하지 않는다. */
export function validateEvidence(evidence) {
  const v = evidence?.verification;
  if (!v || typeof v !== 'object') return 'evidence.verification 객체가 필요합니다';
  if (!['passed', 'verified'].includes(v.status)) return "verification.status는 'passed'|'verified'여야 합니다";
  if (!Array.isArray(v.commands) || v.commands.length === 0 || v.commands.some((c) => !c?.trim())) {
    return 'verification.commands는 비어 있지 않은 명령 목록이어야 합니다';
  }
  if (typeof v.evidence !== 'string' || !v.evidence.trim()) return 'verification.evidence 요약이 필요합니다';
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
        fail(`ledger ${index + 1}번째 줄이 JSON이 아닙니다 — 손상된 ledger는 수동 복구 대상입니다`);
      }
    });
};

/** ledger에서 스냅샷 상태를 재유도한다 — reconcile과 validate의 공용 심장. */
export function deriveFromLedger(events) {
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
    errors.push(`schema_version ${snapshot.schema_version} — 지원 버전은 ${SCHEMA_VERSION}`);
  }
  events.forEach((event, index) => {
    if (event.seq !== index + 1) errors.push(`ledger seq가 단조 증가하지 않습니다: ${index + 1}번째 줄 seq=${event.seq}`);
    if (!EVENTS.includes(event.event)) errors.push(`알 수 없는 이벤트: ${event.event}`);
  });
  const tail = events.length;
  if (snapshot.last_event_id > tail) {
    errors.push(`ledger가 잘렸습니다 — 스냅샷 last_event_id=${snapshot.last_event_id}, ledger 꼬리=${tail}. append-only 위반`);
  }
  if (snapshot.last_event_id < tail) {
    errors.push(`스냅샷이 뒤처졌습니다 — reconcile로 ledger에서 재유도하세요`);
  }
  const derived = deriveFromLedger(events);
  for (const goal of snapshot.goals) {
    if (!GOAL_STATUSES.includes(goal.status)) errors.push(`${goal.id}: 알 수 없는 상태 ${goal.status}`);
    const expected = derived.goals.get(goal.id);
    if (expected && snapshot.last_event_id === tail && expected.status !== goal.status) {
      errors.push(`${goal.id}: 스냅샷(${goal.status})과 ledger 유도 상태(${expected.status})가 다릅니다`);
    }
  }
  return errors;
}

function loadState(slug) {
  if (!existsSync(snapshotPath(slug))) fail(`.omj/goals/${slug}/goals.json이 없습니다 — init 먼저`);
  const snapshot = JSON.parse(readFileSync(snapshotPath(slug), 'utf8'));
  const events = readLedger(slug);
  const errors = integrityErrors(snapshot, events);
  if (errors.length > 0) fail(`무결성 검사 실패:\n- ${errors.join('\n- ')}`);
  return { snapshot, events };
}

function writeSnapshot(slug, snapshot) {
  const target = snapshotPath(slug);
  const temp = `${target}.tmp`;
  snapshot.updated_at = new Date().toISOString();
  writeFileSync(temp, `${JSON.stringify(snapshot, null, 2)}\n`);
  renameSync(temp, target); // 원자적 교체 — 중단돼도 반쯤 쓰인 스냅샷이 남지 않는다
}

function appendEvent(slug, snapshot, event) {
  const entry = { seq: snapshot.last_event_id + 1, ts: new Date().toISOString(), ...event };
  appendFileSync(ledgerPath(slug), `${JSON.stringify(entry)}\n`);
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

const normalizeGoals = (raw, startIndex = 0) =>
  raw.map((goal, index) => {
    if (!goal.title?.trim() || !goal.objective?.trim()) fail('각 골은 title과 objective가 필요합니다');
    return { id: goal.id ?? `G${String(startIndex + index + 1).padStart(3, '0')}`, title: goal.title, objective: goal.objective };
  });

function main() {
  const [verb, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const slug = args.slug;
  if (!verb) fail('사용법: goal-state.mjs <init|transition|add-goal|close|status|validate|reconcile> --slug <slug> …');
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail('--slug는 소문자·숫자·하이픈만 허용합니다');

  if (verb === 'init') {
    if (existsSync(goalsRoot(slug))) fail(`.omj/goals/${slug}/가 이미 있습니다 — 재개는 status/reconcile, 새 계획은 다른 slug로`);
    const brief = args['brief-file'] ? readFileSync(args['brief-file'], 'utf8') : args.brief;
    if (!brief?.trim()) fail('--brief 또는 --brief-file이 필요합니다');
    let goals;
    try {
      goals = normalizeGoals(JSON.parse(args['goals-json'] ?? '[]'));
    } catch (error) {
      fail(`--goals-json 파싱 실패: ${error.message}`);
    }
    if (goals.length === 0) fail('골이 최소 1개 필요합니다');

    mkdirSync(goalsRoot(slug), { recursive: true });
    writeFileSync(path.join(goalsRoot(slug), 'brief.md'), brief);
    const snapshot = {
      schema_version: SCHEMA_VERSION,
      slug,
      closed: false,
      created_at: new Date().toISOString(),
      updated_at: null,
      last_event_id: 0,
      goals: goals.map((goal) => ({ ...goal, status: 'pending', evidence: null, reason: null })),
    };
    writeFileSync(ledgerPath(slug), '');
    appendEvent(slug, snapshot, { event: 'plan_created', goals });
    writeSnapshot(slug, snapshot);
    return ok({ initialized: slug, goals: snapshot.goals.map((g) => ({ id: g.id, title: g.title, status: g.status })) });
  }

  const { snapshot } = loadState(slug);

  if (verb === 'status') {
    return ok(snapshot);
  }

  if (verb === 'validate') {
    return ok({ valid: true, slug, goals: snapshot.goals.length, last_event_id: snapshot.last_event_id, closed: snapshot.closed });
  }

  if (snapshot.closed) fail('이미 close된 계획입니다 — 새 slug로 init하세요');

  if (verb === 'transition') {
    const goal = snapshot.goals.find((g) => g.id === args.goal);
    if (!goal) fail(`골 ${args.goal}을 찾을 수 없습니다`);
    const to = args.to;
    if (!GOAL_STATUSES.includes(to)) fail(`알 수 없는 상태: ${to}`);
    if (!TRANSITIONS[goal.status].includes(to)) {
      fail(`유효하지 않은 전이: ${goal.id} ${goal.status} → ${to} (허용: ${TRANSITIONS[goal.status].join(', ') || '없음'})`);
    }
    if (to === 'active') {
      const active = snapshot.goals.find((g) => g.status === 'active');
      if (active) fail(`단일 owner 규칙: ${active.id}가 이미 active입니다 — 먼저 complete/blocked/failed로 전이하세요`);
    }
    let evidence = null;
    if (to === 'complete') {
      try {
        evidence = JSON.parse(args['evidence-json'] ?? 'null');
      } catch (error) {
        fail(`--evidence-json 파싱 실패: ${error.message}`);
      }
      const evidenceError = validateEvidence(evidence);
      if (evidenceError) fail(`증거 불충분 — ${evidenceError}. 증거 객체 없이는 완료가 성립하지 않습니다`);
    }
    if ((to === 'blocked' || to === 'failed') && !args.reason?.trim()) fail(`${to} 전이에는 --reason이 필요합니다`);

    const event = appendEvent(slug, snapshot, {
      event: TRANSITION_EVENT[`${goal.status}>${to}`],
      goal_id: goal.id,
      ...(evidence ? { evidence } : {}),
      ...(args.reason ? { reason: args.reason } : {}),
    });
    goal.status = to;
    if (evidence) goal.evidence = evidence;
    if (args.reason) goal.reason = args.reason;
    writeSnapshot(slug, snapshot);
    return ok({ transitioned: goal.id, to, seq: event.seq });
  }

  if (verb === 'add-goal') {
    const [goal] = normalizeGoals([{ title: args.title, objective: args.objective }], snapshot.goals.length);
    if (snapshot.goals.some((g) => g.id === goal.id)) fail(`골 id 충돌: ${goal.id}`);
    appendEvent(slug, snapshot, { event: 'goal_added', goals: [goal] });
    snapshot.goals.push({ ...goal, status: 'pending', evidence: null, reason: null });
    writeSnapshot(slug, snapshot);
    return ok({ added: goal.id, title: goal.title });
  }

  if (verb === 'close') {
    const incomplete = snapshot.goals.filter((g) => g.status !== 'complete' || validateEvidence(g.evidence) !== null);
    if (incomplete.length > 0) {
      fail(`close 불가 — 증거를 갖춘 complete가 아닌 골: ${incomplete.map((g) => `${g.id}(${g.status})`).join(', ')}`);
    }
    appendEvent(slug, snapshot, { event: 'plan_closed' });
    snapshot.closed = true;
    writeSnapshot(slug, snapshot);
    return ok({ closed: slug, goals: snapshot.goals.length });
  }

  fail(`알 수 없는 동사: ${verb}`);
}

/** reconcile은 무결성 게이트 앞에서 동작해야 하므로 별도 진입로를 갖는다. */
function reconcileMain(slug) {
  if (!existsSync(snapshotPath(slug))) fail(`.omj/goals/${slug}/goals.json이 없습니다 — init 먼저`);
  const snapshot = JSON.parse(readFileSync(snapshotPath(slug), 'utf8'));
  const events = readLedger(slug);
  if (snapshot.last_event_id > events.length) {
    fail(`ledger가 스냅샷보다 짧습니다(잘림) — 소실된 이벤트는 재유도할 수 없습니다. 백업에서 ledger를 복구하세요`);
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
    const args = parseArgs(rest);
    if (!args.slug) fail('--slug가 필요합니다');
    reconcileMain(args.slug);
  } else {
    main();
  }
}
