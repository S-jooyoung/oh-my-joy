#!/usr/bin/env node
/**
 * task-completed-evidence.mjs — TaskCompleted hook: an ultragoal teammate task closes only with a passing evidence line.
 *
 * Distribution: canon lives in the oh-my-joy plugin's templates/hooks/ → /oh-my-joy:setup copies it
 * into the consuming project's .claude/hooks/ and registers it under hooks.TaskCompleted in
 * .claude/settings.json (opt-in, no matcher).
 * Gate: without a `teamEvidenceGate: true` declaration in the project root's .omj/fe-context.md, always no-op.
 * Scope: only tasks whose description carries the ultragoal marker `omj: <slug>`; every other task list
 * is left alone, so the hook never interferes with work that is not an approved OMJ goal.
 *
 * The host fires TaskCompleted when any agent completes a task through TaskUpdate and when a teammate
 * ends its turn with in-progress tasks. Exit 2 keeps the task open and feeds stderr back to the model;
 * the lead's ledger (helper `verify`) stays the source of truth, so this hook reruns nothing.
 *
 * **Self-containment constraint**: /oh-my-joy:setup copies this single file, so it imports no shared modules.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Risk class: gate (blocks on purpose, crashes fail open). The intentional exit 2 happens only inside
 * the check below, when a declared project closes a marked task without a passing evidence line.
 * Every other path exits 0, and this handler extends the same guarantee to unexpected crashes: a
 * defect in the hook itself must not freeze a task list.
 */
process.on('uncaughtException', (error) => {
  console.error(`[omj:task-completed-evidence] gate hook crashed (fail-open): ${error?.message ?? error}`);
  process.exit(0);
});

const MARKER = /(^|\s)omj:\s+\S/;
const EVIDENCE_LINE = /^\s*evidence:\s*.+?\s*·\s*exit\s+(\d+)\s*·/gm;

const MESSAGE =
  '[omj:task-completed-evidence] task completion needs an evidence line: `evidence: <command> · exit 0 · <summary>` — run the assigned check and add it with TaskUpdate, or report a blocker';

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

const input = readStdin();
if (!input || typeof input !== 'object') process.exit(0);

// TaskCompleted input documents no cwd of its own; when the host supplies one it wins, otherwise the
// hook runs from the project root the host launched it in.
const projectRoot = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
const fcPath = path.join(projectRoot, '.omj', 'fe-context.md');
if (!existsSync(fcPath)) process.exit(0);

let feContext;
try {
  feContext = readFileSync(fcPath, 'utf8');
} catch {
  process.exit(0); // unreadable (directory, permissions, …) → not a declaration, so no gate
}
if (!/^teamEvidenceGate:\s*true\s*$/m.test(feContext)) process.exit(0);

const description = typeof input.task_description === 'string' ? input.task_description : '';
if (!MARKER.test(description)) process.exit(0);

// A task may carry a failing reproduction run followed by the passing run; one passing line closes it.
const passed = [...description.matchAll(EVIDENCE_LINE)].some((m) => Number(m[1]) === 0);
if (passed) process.exit(0);

console.error(MESSAGE);
process.exit(2);
