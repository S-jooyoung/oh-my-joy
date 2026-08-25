#!/usr/bin/env node
/**
 * check-story-exists.mjs — PostToolUse(Edit|Write) hook: missing-Story warning on component save.
 *
 * Distribution: canon lives in the oh-my-joy plugin's templates/hooks/ → /oh-my-joy:setup copies it
 * into the consuming project's .claude/hooks/ and registers it in .claude/settings.json (opt-in).
 * Gate: without a `storybook: true` declaration in the project root's .omj/fe-context.md, always no-op.
 * Checks only; never fixes or blocks (injects warning context, exit 0).
 *
 * **Self-containment constraint**: /oh-my-joy:setup copies this single file, so it imports no shared modules.
 *
 * **The definition of "component" decides this hook's accuracy.** Not every `.tsx` is a Story
 * target — Next.js App Router reserved files (page/layout/route…) are routing entry points, and
 * files starting lowercase are hooks/utils by convention. Without filtering these, the warning
 * fires constantly and gets ignored.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Risk class: advisory (fail-open). Every guarded failure path below already exits 0;
 * this handler extends the same guarantee to unexpected crashes so a defect in a
 * check-only hook can never block the session. Only a destructive-mutation or
 * security-boundary hook could justify failing closed — this plugin ships none.
 */
process.on('uncaughtException', (error) => {
  console.error(`[omj:check-story-exists] advisory hook crashed (fail-open): ${error?.message ?? error}`);
  process.exit(0);
});

const COMPONENT_EXT = /\.(tsx|jsx)$/;

/** Tools this hook fires on. Even if the consuming project's matcher widens, stay silent on non-mutating tools. */
const MUTATING_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** Files that carry no Story — tests/stories themselves and Next.js App Router reserved files. */
const NOT_A_COMPONENT = /\.(stories|test|spec)\.|^(page|layout|template|loading|error|global-error|not-found|route|default|middleware|instrumentation)\./;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function findFeContext(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const p = path.join(dir, '.omj', 'fe-context.md');
    if (existsSync(p)) return p;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const listFiles = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return null;
  }
};

const input = readStdin();
if (!input) process.exit(0);

if (input.tool_name && !MUTATING_TOOLS.has(input.tool_name)) process.exit(0);

const filePath = input.tool_input?.file_path ?? '';
if (!COMPONENT_EXT.test(filePath)) process.exit(0);

// Exclusion is judged on the file name — against the full path, `^page\.`-style anchors could never match.
const fileName = path.basename(filePath);
if (NOT_A_COMPONENT.test(fileName)) process.exit(0);

const cwd = input.cwd || process.cwd();
const fcPath = findFeContext(cwd);
if (!fcPath) process.exit(0);

let feContext;
try {
  feContext = readFileSync(fcPath, 'utf8');
} catch {
  process.exit(0); // unreadable (directory, permissions, …) → a check-only hook never blocks the session (fail-open)
}
if (!/^storybook:\s*true\s*$/m.test(feContext)) process.exit(0);

// Path anchoring is unified on the single cwd the hook contract provides.
const projectRoot = path.dirname(path.dirname(fcPath));
const resolved = path.resolve(cwd, filePath);

// For files outside the project, do not even emit the name into context or open directories.
// (Same containment rule as the sibling hook check-design-tokens.mjs — the two hooks' criteria
//  are kept aligned. `resolved !== projectRoot` is always true for a file path but stays for symmetry.)
if (resolved !== projectRoot && !resolved.startsWith(projectRoot + path.sep)) process.exit(0);

const dir = path.dirname(resolved);
const stem = path.basename(resolved).replace(COMPONENT_EXT, '');

// In the `Button/index.tsx` barrel pattern the sibling Story is `Button.stories.tsx` — the
// component name is the directory, not the file, so both are candidates.
const candidates = stem === 'index' ? [path.basename(dir), stem] : [stem];

// Lowercase-first means hook/util by convention (`useModal.tsx`, `utils.tsx`). index was resolved above.
if (!/^[A-Z]/.test(candidates[0])) process.exit(0);

/**
 * Where to look for Stories. The default is sibling files; projects collecting Stories in a
 * separate directory declare it via `storiesDir:` in fe-context (axes are project-declared — PRINCIPLES ⑩).
 */
const storiesDirMatch = feContext.match(/^storiesDir:\s*(\S+)/m);
const searchDirs = [dir];
if (storiesDirMatch) searchDirs.push(path.resolve(projectRoot, storiesDirMatch[1]));

// An unreadable directory is evidence neither of "no Story" nor of "Story exists".
// Promoting it to `true` would let one storiesDir typo short-circuit `.some()` and silence the
// hook permanently across the project — judge from whichever directories are readable.
const readable = searchDirs.map(listFiles).filter(Boolean);
if (readable.length === 0) process.exit(0);

const hasStory = readable.some((entries) =>
  entries.some((f) => candidates.some((name) => f.startsWith(`${name}.stories.`))),
);
if (hasStory) process.exit(0);

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `[omj:check-story-exists] no ${candidates[0]}.stories.* found for ${fileName} — this project declares storybook: true (adding a Story is recommended).`,
    },
  }),
);
process.exit(0);
