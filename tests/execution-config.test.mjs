import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveConfig, loadConfig, executionRoute, dispatchCapacity } from '../scripts/execution-config.mjs';

test('request overrides project and personal settings without losing the other host model', () => {
  const result = resolveConfig({ personal: { leader: 'codex', maxWorkers: 3, models: { codex: 'chosen' } }, project: { maxWorkers: 2, models: { claude: 'available' } }, request: { maxWorkers: 1 } });
  assert.equal(result.effective.leader, 'codex');
  assert.equal(result.effective.maxWorkers, 1);
  assert.deepEqual(result.effective.models, { codex: 'chosen', claude: 'available' });
  assert.equal(result.sources.maxWorkers, 'request');
});

test('invalid configuration blocks rather than silently changing team behavior', () => {
  for (const config of [{ maxWorkers: 0 }, { maxWorkers: 1.5 }, { maxWorkers: '2' }, { workers: 'other' }, { maxWorker: 3 }, { models: [] }, { models: { other: 'model' } }]) {
    assert.throws(() => resolveConfig({ project: config }));
  }
  assert.throws(() => resolveConfig({ project: { crossReview: 'off' }, legacyCrossReview: 'required' }), /resolve the conflict/);
  assert.equal(resolveConfig({ personal: { crossReview: 'off' }, legacyCrossReview: 'required' }).effective.crossReview, 'required');
});

test('reads isolated user and project configuration and diagnoses malformed JSON', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'execution-config-'));
  try {
    mkdirSync(path.join(root, '.config/oh-my-joy'), { recursive: true });
    mkdirSync(path.join(root, '.omj'));
    writeFileSync(path.join(root, '.config/oh-my-joy/config.json'), '{"leader":"codex"}');
    writeFileSync(path.join(root, '.omj/config.json'), '{"workers":"mixed"}');
    assert.equal(loadConfig({ root, home: root }).effective.leader, 'codex');
    assert.equal(loadConfig({ root, home: root }).effective.workers, 'mixed');
    writeFileSync(path.join(root, '.omj/fe-context.md'), 'crossReview: "required" # keep independent review\n');
    assert.equal(loadConfig({ root, home: root }).effective.crossReview, 'required');
    writeFileSync(path.join(root, '.omj/fe-context.md'), 'crossReview: typo\n');
    assert.throws(() => loadConfig({ root, home: root }), /invalid crossReview/);
    writeFileSync(path.join(root, '.omj/fe-context.md'), 'crossReview: required\n');
    writeFileSync(path.join(root, '.omj/config.json'), '{');
    assert.throws(() => loadConfig({ root, home: root }), /config.json/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('direct execution requires every safety fact; approved plans and resumes retain their contracts', () => {
  const facts = Object.fromEntries(['clearGoal', 'boundedLocalChange', 'knownVerification', 'singleHost', 'noPublicContractChange', 'noSensitiveChange', 'noExternalWrite'].map(key => [key, true]));
  assert.equal(executionRoute(facts), 'direct');
  for (const key of Object.keys(facts)) assert.equal(executionRoute({ ...facts, [key]: false }), 'plan');
  assert.equal(executionRoute({}), 'plan');
  assert.equal(executionRoute({ ...facts, explicitPlanning: true }), 'plan');
  assert.equal(executionRoute({ ...facts, approvedPlan: true }), 'planned');
  assert.equal(executionRoute({ ...facts, resume: true }), 'resume');
});

test('capacity includes reviewers, starting and uncertain workers until confirmed stopped', () => {
  const active = [{ id: 'implementer', state: 'running' }, { id: 'reviewer', state: 'unknown' }];
  assert.equal(dispatchCapacity({ maxWorkers: 2, active }), 0);
  assert.equal(dispatchCapacity({ maxWorkers: 3, hostLimit: 1, active }), 0);
  assert.equal(dispatchCapacity({ maxWorkers: 2, active: [{ id: 'done', state: 'waiting' }] }), 1);
  assert.equal(dispatchCapacity({ maxWorkers: 2, active: [{ id: 'done', state: 'stopped' }] }), 2);
  assert.throws(() => dispatchCapacity({ maxWorkers: 2, active: [active[0], active[0]] }), /duplicate/);
});
