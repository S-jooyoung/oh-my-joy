#!/usr/bin/env node
/**
 * Codex PostToolUse adapter for OMJ's existing frontend checks.
 * Copy this file and the selected check-*.mjs siblings into .codex/hooks/.
 * Codex's apply_patch uses tool_input.command, not Claude's file_path.
 * Risk class: advisory. Recognize patch targets without executing tool input;
 * unknown shell commands remain uninspected rather than guessed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.on('uncaughtException', () => {
  console.error('[omj:codex-hooks] advisory check unavailable (fail-open)');
  process.exit(0);
});

function patchText(input) {
  if (typeof input.tool_input?.command !== 'string') return null;
  const command = input.tool_input.command.trim();
  if (input.tool_name === 'apply_patch') return command;
  if (input.tool_name !== 'Bash') return null;
  // Only a standalone apply_patch heredoc is understood. No shell is invoked.
  const heredoc = /^apply_patch\s+<<(['"]?)([A-Za-z_][A-Za-z_0-9]*)\1[ \t]*\r?\n([\s\S]*)\r?\n\2\s*$/.exec(command);
  return heredoc?.[3].trim() ?? null;
}

function targets(patch) {
  if (!patch) return [];
  const lines = patch.split(/\r?\n/);
  if (lines[0] !== '*** Begin Patch' || lines.at(-1) !== '*** End Patch') return [];
  const files = new Set();
  let current;
  for (const line of lines.slice(1, -1)) {
    const operation = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (operation) {
      current = operation[1] === 'Delete' ? null : operation[2];
      if (current) files.add(current);
      else files.delete(operation[2]);
    }
    const move = /^\*\*\* Move to: (.+)$/.exec(line);
    if (move && current) {
      files.delete(current);
      files.add(move[1]);
      current = move[1];
    }
  }
  return [...files];
}

function projectRoot(cwd) {
  let dir = cwd;
  for (;;) {
    if (existsSync(path.join(dir, '.omj/fe-context.md'))) return realpathSync(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const input = JSON.parse(readFileSync(0, 'utf8'));
if (!input || input.hook_event_name !== 'PostToolUse') process.exit(0);
const affected = targets(patchText(input));
if (!affected.length) process.exit(0);
const cwd = realpathSync(input.cwd || process.cwd());
const root = projectRoot(cwd);
if (!root) process.exit(0);
const checks = ['check-design-tokens.mjs', 'check-story-exists.mjs'];
const directory = path.dirname(fileURLToPath(import.meta.url));
const warnings = [];

for (const file of affected) {
  if (!/\.(tsx|jsx|ts|mts|cts|css|scss|sass|less)$/.test(file)) continue;
  let absolute;
  try {
    absolute = realpathSync(path.resolve(cwd, file));
    if (!absolute.startsWith(root + path.sep) || !statSync(absolute).isFile()) continue;
  } catch { continue; }
  for (const name of checks) {
    const script = path.join(directory, name);
    if (!existsSync(script)) continue; // Only selected checks are installed.
    try {
      const stdout = execFileSync(process.execPath, [script], {
        cwd: root,
        input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', cwd: root, tool_input: { file_path: absolute } }),
        encoding: 'utf8',
        timeout: 3000,
        maxBuffer: 128 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      if (!stdout.trim()) continue;
      const context = JSON.parse(stdout).hookSpecificOutput?.additionalContext;
      if (typeof context === 'string' && context) warnings.push(context);
    } catch {
      console.error(`[omj:codex-hooks] ${name} unavailable (fail-open)`);
    }
  }
}

if (warnings.length) {
  const context = [...new Set(warnings)].join('\n\n');
  console.log(JSON.stringify({
    systemMessage: context,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context },
  }));
}
