/**
 * goal-state validator의 동작 증명 — 픽스처가 아니라 실제 자식 프로세스로.
 *
 * 이 스크립트는 `/oh-my-joy:goal-loop`의 유일한 상태 변경 경로라, 여기서 깨지는
 * 회귀는 곧 "증거 없는 완료가 통과하는" 회귀다. 훅 테스트와 같은 이유로 함수
 * import가 아니라 프로세스 경계(argv/exit code)를 검증하고, 문서에 적힌 이벤트
 * 어휘가 스크립트의 실제 어휘와 어긋나는 드리프트도 여기서 잡는다.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { repoPath, readRepoFile } from './helpers/repo.mjs';
import { EVENTS, GOAL_STATUSES, TRANSITIONS, SCHEMA_VERSION, validateEvidence } from '../scripts/goal-state.mjs';

const SCRIPT = repoPath('scripts', 'goal-state.mjs');

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function makeRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'omj-goal-'));
  roots.push(root);
  return root;
}

function run(cwd, args) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status, stderr: String(error.stderr) };
  }
}

const GOALS = '[{"title":"골 하나","objective":"첫 목표"},{"title":"골 둘","objective":"둘째 목표"}]';
const EVIDENCE = JSON.stringify({
  verification: { status: 'passed', commands: ['node --test'], evidence: '157 passed' },
});

const initDemo = (root) => run(root, ['init', '--slug', 'demo', '--brief', '브리프', '--goals-json', GOALS]);

describe('goal-state: 생성과 정상 전이', () => {
  const root = makeRoot();

  it('init이 brief·스냅샷·ledger를 만들고 plan_created를 남긴다', () => {
    assert.equal(initDemo(root).code, 0);
    const snapshot = JSON.parse(readFileSync(path.join(root, '.omj/goals/demo/goals.json'), 'utf8'));
    assert.equal(snapshot.schema_version, SCHEMA_VERSION);
    assert.equal(snapshot.goals.length, 2);
    const ledger = readFileSync(path.join(root, '.omj/goals/demo/ledger.jsonl'), 'utf8').trim().split('\n');
    assert.equal(JSON.parse(ledger[0]).event, 'plan_created');
  });

  it('pending→active→complete(증거 포함)가 seq를 단조 증가시키며 통과한다', () => {
    assert.equal(run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']).code, 0);
    assert.equal(
      run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'complete', '--evidence-json', EVIDENCE]).code,
      0,
    );
    const events = readFileSync(path.join(root, '.omj/goals/demo/ledger.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(events.map((e) => e.seq), [1, 2, 3]);
  });

  it('미완 골이 남은 close는 거부되고, 전부 완료되면 close된다', () => {
    assert.match(run(root, ['close', '--slug', 'demo']).stderr, /close 불가/);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G002', '--to', 'active']);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G002', '--to', 'complete', '--evidence-json', EVIDENCE]);
    assert.equal(run(root, ['close', '--slug', 'demo']).code, 0);
    assert.match(run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']).stderr, /이미 close/);
  });
});

describe('goal-state: 강제 규칙', () => {
  it('증거 객체 없는 complete는 완료로 성립하지 않는다', () => {
    const root = makeRoot();
    initDemo(root);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    const bare = run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'complete']);
    assert.equal(bare.code, 1);
    assert.match(bare.stderr, /증거 불충분/);
    const empty = run(root, [
      'transition', '--slug', 'demo', '--goal', 'G001', '--to', 'complete',
      '--evidence-json', '{"verification":{"status":"passed","commands":[],"evidence":"x"}}',
    ]);
    assert.match(empty.stderr, /commands/);
  });

  it('단일 owner — 두 번째 active 전이는 거부된다', () => {
    const root = makeRoot();
    initDemo(root);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    const second = run(root, ['transition', '--slug', 'demo', '--goal', 'G002', '--to', 'active']);
    assert.equal(second.code, 1);
    assert.match(second.stderr, /단일 owner/);
  });

  it('전이표 밖 전이(pending→complete)와 사유 없는 blocked는 거부된다', () => {
    const root = makeRoot();
    initDemo(root);
    assert.match(
      run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'complete', '--evidence-json', EVIDENCE]).stderr,
      /유효하지 않은 전이/,
    );
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    assert.match(run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'blocked']).stderr, /--reason/);
  });

  it('add-goal이 pending 골을 append한다 (리뷰 실패 → blocker 골 경로)', () => {
    const root = makeRoot();
    initDemo(root);
    assert.equal(run(root, ['add-goal', '--slug', 'demo', '--title', '후속', '--objective', '리뷰 지적 해소']).code, 0);
    const snapshot = JSON.parse(readFileSync(path.join(root, '.omj/goals/demo/goals.json'), 'utf8'));
    assert.equal(snapshot.goals.length, 3);
    assert.equal(snapshot.goals[2].status, 'pending');
  });
});

describe('goal-state: 경로 검증 (사전승인 아래로 숨는 우회 차단)', () => {
  it('reconcile 진입로도 slug 정규식을 지난다 — traversal slug 거부', () => {
    const root = makeRoot();
    initDemo(root);
    const result = run(root, ['reconcile', '--slug', '../../x']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /소문자·숫자·하이픈/);
  });

  it('init --brief-file은 절대경로·traversal을 거부한다', () => {
    const root = makeRoot();
    const absolute = run(root, ['init', '--slug', 'demo', '--brief-file', '/etc/hosts', '--goals-json', GOALS]);
    assert.equal(absolute.code, 1);
    assert.match(absolute.stderr, /상대경로만/);
    const traversal = run(root, ['init', '--slug', 'demo', '--brief-file', '../outside.md', '--goals-json', GOALS]);
    assert.equal(traversal.code, 1);
    assert.match(traversal.stderr, /상대경로만/);
  });

  it('win32 절대경로(드라이브·UNC)와 백슬래시 traversal도 거부한다 — POSIX 전용 가드의 구멍', () => {
    const root = makeRoot();
    for (const briefFile of ['C:\\evil\\b.md', 'C:/evil/b.md', '\\\\srv\\share\\b.md', 'a\\..\\outside.md']) {
      const result = run(root, ['init', '--slug', 'demo', '--brief-file', briefFile, '--goals-json', GOALS]);
      assert.equal(result.code, 1, `${briefFile}가 가드를 통과했습니다`);
      assert.match(result.stderr, /상대경로만/);
    }
  });
});

describe('goal-state: init 원자성', () => {
  it('성공한 init은 .tmp- 잔재를 남기지 않고 완결 디렉터리만 남긴다', () => {
    const root = makeRoot();
    assert.equal(initDemo(root).code, 0);
    const entries = readdirSync(path.join(root, '.omj/goals'));
    assert.deepEqual(entries, ['demo'], `잔재가 남았습니다: ${entries.join(', ')}`);
    for (const file of ['brief.md', 'goals.json', 'ledger.jsonl']) {
      assert.ok(existsSync(path.join(root, '.omj/goals/demo', file)), `${file} 누락`);
    }
  });

  it('크래시 잔해(.tmp- 디렉터리)가 있어도 재init이 성공하고 잔해를 청소한다', () => {
    const root = makeRoot();
    // 중간 크래시를 재현: 다른 pid의 temp 경로만 만들어지고 rename 전에 죽은 상태.
    mkdirSync(path.join(root, '.omj/goals/demo.tmp-99999'), { recursive: true });
    assert.equal(initDemo(root).code, 0);
    assert.ok(existsSync(path.join(root, '.omj/goals/demo/goals.json')));
    assert.deepEqual(
      readdirSync(path.join(root, '.omj/goals')),
      ['demo'],
      '다른 pid의 .tmp- 잔해가 청소되지 않았습니다',
    );
  });
});

describe('goal-state: 손상 감지와 복구', () => {
  it('ledger 잘림은 전이·validate·reconcile 전부에서 거부된다 (append-only)', () => {
    const root = makeRoot();
    initDemo(root);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    const ledgerFile = path.join(root, '.omj/goals/demo/ledger.jsonl');
    const lines = readFileSync(ledgerFile, 'utf8').trim().split('\n');
    writeFileSync(ledgerFile, `${lines[0]}\n`); // 마지막 이벤트 절단
    assert.match(run(root, ['transition', '--slug', 'demo', '--goal', 'G002', '--to', 'active']).stderr, /잘렸습니다/);
    assert.equal(run(root, ['validate', '--slug', 'demo']).code, 1);
    assert.match(run(root, ['reconcile', '--slug', 'demo']).stderr, /짧습니다/);
  });

  it('스냅샷 오염은 validate가 잡고 reconcile이 ledger에서 재유도한다', () => {
    const root = makeRoot();
    initDemo(root);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    const snapshotFile = path.join(root, '.omj/goals/demo/goals.json');
    const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'));
    snapshot.goals[1].status = 'complete'; // ledger에 없는 완료 조작
    writeFileSync(snapshotFile, JSON.stringify(snapshot));
    assert.match(run(root, ['validate', '--slug', 'demo']).stderr, /유도 상태/);
    assert.equal(run(root, ['reconcile', '--slug', 'demo']).code, 0);
    assert.equal(run(root, ['validate', '--slug', 'demo']).code, 0);
    const restored = JSON.parse(readFileSync(snapshotFile, 'utf8'));
    assert.equal(restored.goals[1].status, 'pending');
  });
});

describe('goal-state ↔ commands/goal-loop.md 어휘 드리프트', () => {
  const doc = readRepoFile('commands', 'goal-loop.md');

  it('문서의 예시 ledger 이벤트가 스크립트 어휘의 부분집합이다', () => {
    const exampleEvents = [...doc.matchAll(/"event":\s*"([a-z_]+)"/g)].map((m) => m[1]);
    assert.ok(exampleEvents.length > 0, 'goal-loop.md에 ledger 이벤트 예시가 없습니다');
    for (const event of exampleEvents) {
      assert.ok(EVENTS.includes(event), `문서의 이벤트 ${event}가 스크립트 EVENTS에 없습니다`);
    }
  });

  it('문서가 언급하는 상태 이름이 전이표와 일치한다', () => {
    for (const status of GOAL_STATUSES) {
      assert.ok(doc.includes(status), `문서에 상태 ${status} 설명이 없습니다`);
      assert.ok(status in TRANSITIONS, `전이표에 ${status}가 없습니다`);
    }
  });

  it('증거 필수조건의 문서 예시가 실제 검증기를 통과한다', () => {
    const block = doc.match(/```json\n([\s\S]*?)```/)?.[1];
    assert.ok(block, 'goal-loop.md에 evidence 예시 json 블록이 없습니다');
    const example = JSON.parse(block);
    assert.equal(validateEvidence(example.evidence ?? example), null, '문서의 증거 예시가 검증기에서 거부됩니다');
  });
});
