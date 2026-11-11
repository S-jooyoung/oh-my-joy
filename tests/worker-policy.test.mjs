import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile } from './helpers/repo.mjs';

const contract = readRepoFile('docs/EXECUTION-HANDOFF.md')
  .split('## Worker display and lifecycle\n')[1]?.split('\n## ')[0];

function assertCapacity(source) {
  assert.match(source, /at most 3 workers plus 1 lead/);
  assert.match(source, /Implementation, investigation, exploration, and review workers count together/);
  assert.match(source, /including idle contexts retained for a delta pass/);
  assert.match(source, /workers do not spawn nested workers/);
  assert.match(source, /announce the actual count, roles, queued work, and why execution is parallel or sequential/);
  assert.match(source, /fourth task waits until a worker's retirement is confirmed/);
}

function assertCleanup(source) {
  assert.match(source, /normal completion, failure, or cancellation/);
  assert.match(source, /preserve the worker's result, available logs, and terminal status before terminating/);
  assert.match(source, /Close only the pane whose recorded ownership still matches that worker, after confirming termination/);
  assert.match(source, /preserve the main pane, unrelated panes, and peer sessions/);
  assert.match(source, /release the slot only when retirement is confirmed/);
  assert.match(source, /interrupt or shutdown request alone is not proof of termination/);
  assert.match(source, /report unavailable stop\/close support.*as incomplete cleanup/);
}

describe('shared native worker policy', () => {
  it('bounds mixed roles and idle contexts before admission', () => {
    assertCapacity(contract);
    assert.throws(() => assertCapacity(contract.replace('at most 3 workers', 'at most 4 workers')));
    assert.throws(() => assertCapacity(contract.replace('including idle contexts retained for a delta pass', 'excluding idle reviewers')));
  });

  it('preserves evidence and ownership through every exit', () => {
    assertCleanup(contract);
    assert.throws(() => assertCleanup(contract.replace('before terminating', 'after terminating')));
    assert.throws(() => assertCleanup(contract.replace('normal completion, failure, or cancellation', 'normal completion')));
  });

  it('does not confuse a second execution or invisible session with attached panes', () => {
    assert.match(contract, /split panes of the current terminal window/);
    assert.match(contract, /Claude uses native Agent Teams split-pane mode/);
    assert.match(contract, /Codex keeps native subagents/);
    assert.match(contract, /existing server endpoint, parent\/worker thread-ID mapping/);
    assert.match(contract, /resume that starts a second execution.*does not establish same-worker attachment/);
    assert.match(contract, /Do not replace native workers with independent CLI workers or create a hidden detached tmux session/);
    assert.match(contract, /record native execution and pane display separately/);
    assert.match(contract, /cannot satisfy a pane-display acceptance criterion/);
  });

  for (const name of ['ralplan', 'ultragoal', 'review', 'ship']) {
    it(`${name} loads the same policy on both hosts`, () => {
      for (const file of [`commands/${name}.md`, `skills/${name}/SKILL.md`]) {
        assert.match(readRepoFile(file), /(?:Read and apply|Apply) \[worker display and lifecycle\]\([^\n]*EXECUTION-HANDOFF\.md#worker-display-and-lifecycle\)/, file);
      }
    });
  }

  it('keeps policy replay separate from live acceptance', () => {
    const validation = readRepoFile('docs/WORKER-VALIDATION.md');
    for (const scenario of ['One worker', 'Three independent tasks', 'Fourth task', 'Normal completion', 'Worker failure', 'Cancellation']) {
      assert.ok(validation.includes(`| ${scenario} |`), scenario);
    }
    assert.match(validation, /Both hosts'.*remains \*\*unverified\*\*/);
    assert.match(validation, /Codex pane attachment is \*\*incomplete\*\*/);
    assert.match(readRepoFile('evals/worker-lifecycle-policy/prompt.md'), /policy replay: do not execute tasks or claim live verification/);
  });
});
