/**
 * Behavioral proof of the goal-state validator — through real child processes, not fixtures.
 *
 * The script is the only state-mutation path for `/oh-my-joy:goal-loop`, so a
 * regression here IS the "completion without evidence passes" regression. For the
 * same reason as the hook tests, this verifies the process boundary (argv/exit
 * code) instead of importing functions, and it also catches drift between the
 * event vocabulary written in the docs and the script's actual vocabulary.
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

const GOALS = '[{"title":"Goal one","objective":"First objective"},{"title":"Goal two","objective":"Second objective"}]';
const EVIDENCE = JSON.stringify({
  verification: { status: 'passed', commands: ['node --test'], exitCode: 0, evidence: '157 passed' },
});

const initDemo = (root) => run(root, ['init', '--slug', 'demo', '--brief', 'the brief', '--goals-json', GOALS]);

describe('goal-state: creation and legal transitions', () => {
  const root = makeRoot();

  it('init creates brief, snapshot, and ledger, and records plan_created', () => {
    assert.equal(initDemo(root).code, 0);
    const snapshot = JSON.parse(readFileSync(path.join(root, '.omj/goals/demo/goals.json'), 'utf8'));
    assert.equal(snapshot.schema_version, SCHEMA_VERSION);
    assert.equal(snapshot.goals.length, 2);
    const ledger = readFileSync(path.join(root, '.omj/goals/demo/ledger.jsonl'), 'utf8').trim().split('\n');
    assert.equal(JSON.parse(ledger[0]).event, 'plan_created');
  });

  it('pending→active→complete (with evidence) passes with monotonically increasing seq', () => {
    assert.equal(run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']).code, 0);
    assert.equal(
      run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'complete', '--evidence-json', EVIDENCE]).code,
      0,
    );
    const events = readFileSync(path.join(root, '.omj/goals/demo/ledger.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(events.map((e) => e.seq), [1, 2, 3]);
  });

  it('close is rejected while goals remain incomplete, and succeeds once all are complete', () => {
    assert.match(run(root, ['close', '--slug', 'demo']).stderr, /cannot close/);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G002', '--to', 'active']);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G002', '--to', 'complete', '--evidence-json', EVIDENCE]);
    assert.equal(run(root, ['close', '--slug', 'demo']).code, 0);
    assert.match(run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']).stderr, /already closed/);
  });
});

describe('goal-state: enforced rules', () => {
  it('complete without an evidence object does not count as completion', () => {
    const root = makeRoot();
    initDemo(root);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    const bare = run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'complete']);
    assert.equal(bare.code, 1);
    assert.match(bare.stderr, /insufficient evidence/);
    const empty = run(root, [
      'transition', '--slug', 'demo', '--goal', 'G001', '--to', 'complete',
      '--evidence-json', '{"verification":{"status":"passed","commands":[],"exitCode":0,"evidence":"x"}}',
    ]);
    assert.match(empty.stderr, /commands/);
  });

  it('a missing or non-zero exitCode does not count as passing evidence', () => {
    const root = makeRoot();
    initDemo(root);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    for (const verification of [
      { status: 'passed', commands: ['node --test'], evidence: 'claims green' }, // omitted
      { status: 'passed', commands: ['node --test'], exitCode: 1, evidence: 'actually failed' },
      { status: 'passed', commands: ['node --test'], exitCode: '0', evidence: 'stringly typed' },
    ]) {
      const result = run(root, [
        'transition', '--slug', 'demo', '--goal', 'G001', '--to', 'complete',
        '--evidence-json', JSON.stringify({ verification }),
      ]);
      assert.equal(result.code, 1, `${JSON.stringify(verification)} slipped past the validator`);
      assert.match(result.stderr, /exitCode/);
    }
  });

  it('single owner — a second active transition is rejected', () => {
    const root = makeRoot();
    initDemo(root);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    const second = run(root, ['transition', '--slug', 'demo', '--goal', 'G002', '--to', 'active']);
    assert.equal(second.code, 1);
    assert.match(second.stderr, /single-owner/);
  });

  it('transitions outside the table (pending→complete) and blocked without a reason are rejected', () => {
    const root = makeRoot();
    initDemo(root);
    assert.match(
      run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'complete', '--evidence-json', EVIDENCE]).stderr,
      /invalid transition/,
    );
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    assert.match(run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'blocked']).stderr, /--reason/);
  });

  it('add-goal appends a pending goal (review failure → blocker-goal path)', () => {
    const root = makeRoot();
    initDemo(root);
    assert.equal(run(root, ['add-goal', '--slug', 'demo', '--title', 'Follow-up', '--objective', 'Resolve review findings']).code, 0);
    const snapshot = JSON.parse(readFileSync(path.join(root, '.omj/goals/demo/goals.json'), 'utf8'));
    assert.equal(snapshot.goals.length, 3);
    assert.equal(snapshot.goals[2].status, 'pending');
  });
});

describe('goal-state: path validation (blocking bypasses that hide under pre-approval)', () => {
  it('the reconcile entry point also passes the slug regex — traversal slugs rejected', () => {
    const root = makeRoot();
    initDemo(root);
    const result = run(root, ['reconcile', '--slug', '../../x']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /lowercase letters, digits, and hyphens/);
  });

  it('init --brief-file rejects absolute paths and traversal', () => {
    const root = makeRoot();
    const absolute = run(root, ['init', '--slug', 'demo', '--brief-file', '/etc/hosts', '--goals-json', GOALS]);
    assert.equal(absolute.code, 1);
    assert.match(absolute.stderr, /relative path inside the repo/);
    const traversal = run(root, ['init', '--slug', 'demo', '--brief-file', '../outside.md', '--goals-json', GOALS]);
    assert.equal(traversal.code, 1);
    assert.match(traversal.stderr, /relative path inside the repo/);
  });

  it('win32 absolute paths (drive·UNC) and backslash traversal are rejected too — the POSIX-only-guard hole', () => {
    const root = makeRoot();
    for (const briefFile of ['C:\\evil\\b.md', 'C:/evil/b.md', '\\\\srv\\share\\b.md', 'a\\..\\outside.md']) {
      const result = run(root, ['init', '--slug', 'demo', '--brief-file', briefFile, '--goals-json', GOALS]);
      assert.equal(result.code, 1, `${briefFile} slipped past the guard`);
      assert.match(result.stderr, /relative path inside the repo/);
    }
  });
});

describe('goal-state: init atomicity', () => {
  it('a successful init leaves no .tmp- debris, only the completed directory', () => {
    const root = makeRoot();
    assert.equal(initDemo(root).code, 0);
    const entries = readdirSync(path.join(root, '.omj/goals'));
    assert.deepEqual(entries, ['demo'], `debris left behind: ${entries.join(', ')}`);
    for (const file of ['brief.md', 'goals.json', 'ledger.jsonl']) {
      assert.ok(existsSync(path.join(root, '.omj/goals/demo', file)), `${file} missing`);
    }
  });

  it('re-init succeeds despite crash debris (.tmp- directory) and cleans it up', () => {
    const root = makeRoot();
    // Reproduce a mid-crash: another pid's temp path was created, then died before rename.
    mkdirSync(path.join(root, '.omj/goals/demo.tmp-99999'), { recursive: true });
    assert.equal(initDemo(root).code, 0);
    assert.ok(existsSync(path.join(root, '.omj/goals/demo/goals.json')));
    assert.deepEqual(
      readdirSync(path.join(root, '.omj/goals')),
      ['demo'],
      "another pid's .tmp- debris was not cleaned up",
    );
  });
});

describe('goal-state: corruption detection and recovery', () => {
  it('ledger truncation is rejected by transition, validate, and reconcile alike (append-only)', () => {
    const root = makeRoot();
    initDemo(root);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    const ledgerFile = path.join(root, '.omj/goals/demo/ledger.jsonl');
    const lines = readFileSync(ledgerFile, 'utf8').trim().split('\n');
    writeFileSync(ledgerFile, `${lines[0]}\n`); // cut off the last event
    assert.match(run(root, ['transition', '--slug', 'demo', '--goal', 'G002', '--to', 'active']).stderr, /truncated/);
    assert.equal(run(root, ['validate', '--slug', 'demo']).code, 1);
    assert.match(run(root, ['reconcile', '--slug', 'demo']).stderr, /shorter than the snapshot/);
  });

  it('snapshot tampering is caught by validate and re-derived from the ledger by reconcile', () => {
    const root = makeRoot();
    initDemo(root);
    run(root, ['transition', '--slug', 'demo', '--goal', 'G001', '--to', 'active']);
    const snapshotFile = path.join(root, '.omj/goals/demo/goals.json');
    const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'));
    snapshot.goals[1].status = 'complete'; // fabricated completion absent from the ledger
    writeFileSync(snapshotFile, JSON.stringify(snapshot));
    assert.match(run(root, ['validate', '--slug', 'demo']).stderr, /ledger-derived/);
    assert.equal(run(root, ['reconcile', '--slug', 'demo']).code, 0);
    assert.equal(run(root, ['validate', '--slug', 'demo']).code, 0);
    const restored = JSON.parse(readFileSync(snapshotFile, 'utf8'));
    assert.equal(restored.goals[1].status, 'pending');
  });
});

describe('goal-state ↔ commands/goal-loop.md vocabulary drift', () => {
  const doc = readRepoFile('commands', 'goal-loop.md');

  it("the doc's example ledger events are a subset of the script vocabulary", () => {
    const exampleEvents = [...doc.matchAll(/"event":\s*"([a-z_]+)"/g)].map((m) => m[1]);
    assert.ok(exampleEvents.length > 0, 'goal-loop.md has no ledger event examples');
    for (const event of exampleEvents) {
      assert.ok(EVENTS.includes(event), `doc event ${event} is missing from the script EVENTS`);
    }
  });

  it('the status names the doc mentions match the transition table', () => {
    for (const status of GOAL_STATUSES) {
      assert.ok(doc.includes(status), `the doc does not describe status ${status}`);
      assert.ok(status in TRANSITIONS, `the transition table is missing ${status}`);
    }
  });

  it("the doc's evidence-requirement example passes the real validator", () => {
    const block = doc.match(/```json\n([\s\S]*?)```/)?.[1];
    assert.ok(block, 'goal-loop.md has no evidence example json block');
    const example = JSON.parse(block);
    assert.equal(validateEvidence(example.evidence ?? example), null, "the doc's evidence example is rejected by the validator");
  });
});
