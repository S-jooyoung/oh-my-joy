/**
 * Contract tests for task-completed-evidence.mjs.
 *
 * The hook is a gate, so its contract is the exit code: 2 only when a project declared
 * `teamEvidenceGate: true`, the task carries the ultragoal marker, and no passing evidence line
 * exists. The hook is run with spawnSync rather than the shared runHook helper because that helper
 * throws on a non-zero exit and the exit-2 branch is the behavior under test.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import { repoPath, makeProject } from '../helpers/repo.mjs';

const HOOK = repoPath('templates', 'hooks', 'task-completed-evidence.mjs');
const projects = [];

after(() => projects.forEach((p) => p.cleanup()));

function project(feContext) {
  const tree = { 'package.json': '{}' };
  if (feContext !== null) tree['.omj/fe-context.md'] = feContext;
  const p = makeProject(tree);
  projects.push(p);
  return p;
}

function run(input, { cwd } = {}) {
  const result = spawnSync('node', [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    cwd,
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

const payload = ({ cwd, description }) => ({
  session_id: 'test-session',
  transcript_path: '/dev/null',
  hook_event_name: 'TaskCompleted',
  task_id: 'task-1',
  task_subject: 'G3 team-mode surfaces',
  task_description: description,
  teammate_name: 'G3',
  ...(cwd ? { cwd } : {}),
});

const MARKED = 'omj: v020-speed-teams\nowned files: commands/setup.md\nfocused check: node --test tests/hooks/*.test.mjs';

describe('task-completed-evidence — gate', () => {
  it('(a) no teamEvidenceGate declaration → exit 0', () => {
    const p = project('storybook: true\n');
    const r = run(payload({ cwd: p.root, description: MARKED }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
  });

  it('(b) declaration but no omj: marker → exit 0 (other task lists are untouched)', () => {
    const p = project('teamEvidenceGate: true\n');
    const r = run(payload({ cwd: p.root, description: 'refactor the parser\nfocused check: npm test' }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
  });

  it('(c) declaration + marker + passing evidence line → exit 0', () => {
    const p = project('teamEvidenceGate: true\n');
    const r = run(payload({ cwd: p.root, description: `${MARKED}\nevidence: npm test · exit 0 · 12 pass` }));
    assert.equal(r.status, 0, r.stderr);
  });

  it('(d) declaration + marker + no evidence line → exit 2 with the guidance on stderr', () => {
    const p = project('teamEvidenceGate: true\n');
    const r = run(payload({ cwd: p.root, description: MARKED }));
    assert.equal(r.status, 2);
    assert.match(r.stderr, /task completion needs an evidence line/);
    assert.match(r.stderr, /add it with TaskUpdate, or report a blocker/);
    assert.equal(r.stdout, '');
  });

  it('(e) declaration + marker + failing evidence line → exit 2', () => {
    const p = project('teamEvidenceGate: true\n');
    const r = run(payload({ cwd: p.root, description: `${MARKED}\nevidence: npm test · exit 1 · 1 fail` }));
    assert.equal(r.status, 2);
    assert.match(r.stderr, /task completion needs an evidence line/);
  });

  it('(f) unparseable stdin → exit 0 (fail-open)', () => {
    const p = project('teamEvidenceGate: true\n');
    const r = run('not-json{', { cwd: p.root });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
  });

  it('falls back to the process cwd when the payload carries no cwd field', () => {
    const p = project('teamEvidenceGate: true\n');
    const r = run(payload({ description: MARKED }), { cwd: p.root });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /task completion needs an evidence line/);
  });

  it('teamEvidenceGate: false is not activation', () => {
    const p = project('teamEvidenceGate: false\n');
    const r = run(payload({ cwd: p.root, description: MARKED }));
    assert.equal(r.status, 0, r.stderr);
  });
});
