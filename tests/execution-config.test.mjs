import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveConfig, loadConfig, executionRoute, dispatchCapacity } from '../scripts/execution-config.mjs';

test('request overrides project and personal settings without losing the other host model', () => {
  const result = resolveConfig({ personal: { crossReview: 'preferred', maxWorkers: 3, models: { codex: 'chosen' } }, project: { maxWorkers: 2, models: { claude: 'available' } }, request: { maxWorkers: 1 } });
  assert.equal(result.effective.crossReview, 'preferred');
  assert.equal(result.effective.maxWorkers, 1);
  assert.deepEqual(result.effective.models, { codex: 'chosen', claude: 'available' });
  assert.equal(result.sources.maxWorkers, 'request');
  assert.equal(result.sources.crossReview, 'personal');
});

test('invalid configuration blocks rather than silently changing team behavior', () => {
  for (const config of [{ maxWorkers: 0 }, { maxWorkers: 1.5 }, { maxWorkers: '2' }, { crossReview: 'sometimes' }, { maxWorker: 3 }, { models: [] }, { models: { other: 'model' } }]) {
    assert.throws(() => resolveConfig({ project: config }), undefined, JSON.stringify(config));
  }
  assert.throws(() => resolveConfig({ project: { teamSize: 2 } }), /project: unknown key teamSize/);
});

test('keys removed in 2.0 warn and stay out of the effective configuration', () => {
  const result = resolveConfig({ personal: { leader: 'codex', workers: 'mixed', runtime: 'herdr', maxWorkers: 3 } });
  assert.deepEqual(result.warnings, [
    'personal: leader was removed in 2.0 and is ignored',
    'personal: workers was removed in 2.0 and is ignored',
    'personal: runtime was removed in 2.0 and is ignored',
  ]);
  assert.deepEqual(Object.keys(result.effective).sort(), ['crossReview', 'maxWorkers', 'models']);
  assert.deepEqual(Object.keys(result.sources).sort(), ['crossReview', 'maxWorkers', 'models']);
  assert.equal(result.effective.maxWorkers, 3);
});

test('crossReview required resolves to preferred with a warning in config files and fe-context', () => {
  let result = resolveConfig({ project: { crossReview: 'required' } });
  assert.equal(result.effective.crossReview, 'preferred');
  assert.equal(result.sources.crossReview, 'project');
  assert.deepEqual(result.warnings, ['project: crossReview required was removed in 2.0; using preferred']);

  result = resolveConfig({ personal: { crossReview: 'off' }, legacyCrossReview: 'required' });
  assert.equal(result.effective.crossReview, 'preferred');
  assert.equal(result.sources.crossReview, 'fe-context');
  assert.deepEqual(result.warnings, ['fe-context: crossReview required was removed in 2.0; using preferred']);

  result = resolveConfig({ project: { crossReview: 'off' }, legacyCrossReview: 'required' });
  assert.equal(result.effective.crossReview, 'off', 'an explicit project value still wins');
  assert.deepEqual(result.warnings, [
    'fe-context: crossReview required was removed in 2.0; using preferred',
    'crossReview conflict: project=off, fe-context=preferred',
  ]);
});

test('reads isolated user and project configuration and diagnoses malformed JSON', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'execution-config-'));
  try {
    mkdirSync(path.join(root, '.config/oh-my-joy'), { recursive: true });
    mkdirSync(path.join(root, '.omj'));
    writeFileSync(path.join(root, '.config/oh-my-joy/config.json'), '{"maxWorkers":3,"leader":"codex"}');
    writeFileSync(path.join(root, '.omj/config.json'), '{"crossReview":"preferred"}');
    let result = loadConfig({ root, home: root });
    assert.equal(result.effective.maxWorkers, 3);
    assert.equal(result.effective.crossReview, 'preferred');
    assert.deepEqual(result.warnings, ['personal: leader was removed in 2.0 and is ignored']);
    writeFileSync(path.join(root, '.omj/config.json'), '{}');
    writeFileSync(path.join(root, '.omj/fe-context.md'), 'crossReview: "required" # keep independent review\n');
    result = loadConfig({ root, home: root });
    assert.equal(result.effective.crossReview, 'preferred');
    assert.ok(result.warnings.includes('fe-context: crossReview required was removed in 2.0; using preferred'));
    writeFileSync(path.join(root, '.omj/fe-context.md'), 'crossReview: typo\n');
    assert.throws(() => loadConfig({ root, home: root }), /invalid crossReview/);
    writeFileSync(path.join(root, '.omj/fe-context.md'), 'crossReview: off\n');
    writeFileSync(path.join(root, '.omj/config.json'), '{');
    assert.throws(() => loadConfig({ root, home: root }), /config.json/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the playbook route requires every countable fact; approved plans and resumes retain their contracts', () => {
  const facts = { clearGoal: true, noSensitiveChange: true, noPublicContractChange: true, noExternalWrite: true, deliverables: 1, targetFiles: 5 };
  assert.equal(executionRoute(facts), 'playbook');
  assert.equal(executionRoute({ ...facts, targetFiles: 0 }), 'playbook');
  for (const key of Object.keys(facts)) {
    assert.equal(executionRoute({ ...facts, [key]: false }), 'plan', `${key}: false`);
    const { [key]: _omitted, ...missing } = facts;
    assert.equal(executionRoute(missing), 'plan', `${key} missing`);
  }
  assert.equal(executionRoute({ ...facts, deliverables: 2 }), 'plan');
  assert.equal(executionRoute({ ...facts, targetFiles: 6 }), 'plan');
  assert.equal(executionRoute({ ...facts, targetFiles: '3' }), 'plan');
  assert.equal(executionRoute({ ...facts, targetFiles: -1 }), 'plan');
  assert.equal(executionRoute({ ...facts, targetFiles: 2.5 }), 'plan');
  assert.equal(executionRoute({ ...facts, boundedLocalChange: false, knownVerification: false, singleHost: false }), 'playbook', 'retired facts are ignored');
  assert.equal(executionRoute({}), 'plan');
  assert.equal(executionRoute({ ...facts, explicitPlanning: true }), 'plan');
  assert.equal(executionRoute({ ...facts, approvedPlan: true }), 'planned');
  assert.equal(executionRoute({ ...facts, resume: true }), 'resume');
  const legacyDirect = Object.fromEntries(['clearGoal', 'boundedLocalChange', 'knownVerification', 'singleHost', 'noPublicContractChange', 'noSensitiveChange', 'noExternalWrite'].map((key) => [key, true]));
  assert.equal(executionRoute(legacyDirect), 'plan', 'the 1.5 direct facts alone no longer skip planning');
});

test('capacity includes reviewers, starting and uncertain workers until confirmed stopped', () => {
  const active = [{ id: 'implementer', state: 'running' }, { id: 'reviewer', state: 'unknown' }];
  assert.equal(dispatchCapacity({ maxWorkers: 2, active }), 0);
  assert.equal(dispatchCapacity({ maxWorkers: 3, hostLimit: 1, active }), 0);
  assert.equal(dispatchCapacity({ maxWorkers: 2, active: [{ id: 'done', state: 'waiting' }] }), 1);
  assert.equal(dispatchCapacity({ maxWorkers: 2, active: [{ id: 'done', state: 'stopped' }] }), 2);
  assert.throws(() => dispatchCapacity({ maxWorkers: 2, active: [active[0], active[0]] }), /duplicate/);
});
