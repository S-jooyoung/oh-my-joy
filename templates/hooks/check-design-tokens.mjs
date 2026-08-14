#!/usr/bin/env node
/**
 * check-design-tokens.mjs — PostToolUse(Edit|Write) hook: hardcoded-color detection warning.
 *
 * Distribution: canon lives in the oh-my-joy plugin's templates/hooks/ → /omj-setup copies it
 * into the consuming project's .claude/hooks/ and registers it in .claude/settings.json (opt-in).
 * Gate: without a tokensPath declaration in the project root's .omj/fe-context.md, always no-op.
 * Checks only; never fixes or blocks (injects warning context, exit 0).
 *
 * **Self-containment constraint**: /omj-setup copies this single file. Therefore it imports no
 * shared modules — even where helpers overlap with check-story-exists.mjs, each file carrying its
 * own copy matches the distribution contract (a shared module would break the copies at runtime).
 *
 * **Prefer misses over false positives**: this hook is a non-blocking warning, so accumulated
 * false positives teach users to ignore it wholesale. Positions where color vs identifier cannot
 * be distinguished without syntax (free-position named colors, DOM ids, …) are therefore not
 * checked. Individual false positives are silenced per line with an `omj-allow-color` comment.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** CSS-in-JS/theme objects live in .ts, styles in .css/.scss — colors get hardcoded in both. */
const TARGET_EXT = /\.(tsx|jsx|ts|mts|cts|css|scss|sass|less)$/;

/** Tools this hook fires on. Even if the consuming project's matcher widens, stay silent on non-mutating tools. */
const MUTATING_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** Inline comment that silences the warning for its line (same role as eslint-disable-line). */
const SUPPRESSION = /omj-allow-color/;

/** Only #RGB · #RGBA · #RRGGBB · #RRGGBBAA are CSS colors — 5/7 digits are not. */
const HEX_COLOR =
  /(?<![\w#.$-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g;

/** Longer names first so `rgba(` cannot be truncated into an `rgb` match. */
const COLOR_FUNCTIONS = ['oklch', 'oklab', 'rgba', 'hsla', 'rgb', 'hsl', 'hwb', 'lab', 'lch'];

/**
 * Only named colors in CSS declaration positions are checked. Free-position `red`/`black` cannot
 * be told apart from variable names or Tailwind class fragments, so they are excluded
 * (misses > false positives).
 *
 * The boundary rules are the core of this regex — `-` and `.` are not word characters, so `\b`
 * alone would match color names inside `--color-red-500` (a token reference) or `red.500` (token
 * notation). Reporting the hook's own recommended usage as a violation would get the whole
 * warning ignored, so both boundaries are narrowed. The value scan not crossing `,` exists for
 * the same reason — in a TS object like `{ color: string, tone: "red" }` with several properties
 * on one line, an earlier property must not swallow a later property's value.
 */
const NAMED_COLOR_DECLARATION = new RegExp(
  // property positions: CSS custom properties, `*color` family, shorthand properties taking colors
  String.raw`(?:^|[;{])\s*(?:--[\w-]+|[\w-]*colou?r|background(?:-(?:color|image))?|border(?:-(?:top|right|bottom|left))?|outline|fill|stroke|box-shadow|text-shadow)\s*:\s*[^;{},]*?` +
    String.raw`(?<![\w-.])(?:black|white|red|blue|green|yellow|orange|purple|pink|gray|grey|silver|gold|brown|cyan|magenta|navy|teal|olive|maroon|lime|aqua|fuchsia)(?![\w-.])`,
  'g',
);

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

/** Blank out while preserving line count and column positions — so reported L numbers match the original. */
const blankOut = (text) => text.replace(/[^\n]/g, ' ');

/**
 * Erases regions that are certainly not color literals. Order matters —
 * comments must be erased first so `url(` / `href=` inside comments cannot confuse later steps.
 */
function maskNonColorRegions(source) {
  return (
    source
      // block comments and JSX comments (`{/* … */}`)
      .replace(/\/\*[\s\S]*?\*\//g, blankOut)
      // line comments. Leave `//` after `:` alone so `https://` is not erased.
      .replace(/(^|[^:\\])\/\/[^\n]*/gm, (match, prefix) => prefix + blankOut(match.slice(prefix.length)))
      // `url(#gradient)` in SVG/CSS — an id reference, not a color.
      .replace(/\burl\(([^)\n]*)\)/g, (_match, inner) => `url(${blankOut(inner)})`)
      // `#section` fragments in anchor/router paths
      .replace(/((?:href|to|xlinkHref)\s*=\s*["'`])([^"'`\n]*)/g, (_match, prefix, value) => prefix + blankOut(value))
  );
}

/**
 * Counts color function calls. Arguments containing `var(` are the normal token-referencing
 * pattern and not a violation — as in `hsl(var(--h) var(--s) var(--l))`. Nested parentheses make
 * argument boundaries unreachable by regex alone, so paren depth is counted directly.
 */
function countColorFunctions(line) {
  // The lookbehind must exclude `.` so method calls like `chroma.lab(` / `d3.rgb(` are not taken
  // as colors (`lab`/`lch` are common 3-letter method names in color libraries). Same criterion as HEX_COLOR.
  const pattern = new RegExp(String.raw`(?<![\w-.$])(?:${COLOR_FUNCTIONS.join('|')})\(`, 'gi');
  let count = 0;
  let match;

  while ((match = pattern.exec(line)) !== null) {
    const openIndex = match.index + match[0].length - 1;
    let depth = 0;
    let cursor = openIndex;
    for (; cursor < line.length; cursor++) {
      if (line[cursor] === '(') depth++;
      else if (line[cursor] === ')' && --depth === 0) break;
    }
    // Unclosed within the line = the arguments are unreadable = the var() exemption cannot be
    // judged. Counting the unjudgeable as violations would false-positive multiline
    // `hsl(\n var(--h) …)` — so it is not counted.
    if (cursor >= line.length) continue;
    if (!/var\(/.test(line.slice(openIndex + 1, cursor))) count++;
  }
  return count;
}

function countViolations(line) {
  return (
    (line.match(HEX_COLOR)?.length ?? 0) +
    countColorFunctions(line) +
    (line.match(NAMED_COLOR_DECLARATION)?.length ?? 0)
  );
}

const input = readStdin();
if (!input) process.exit(0);

// Input without tool_name (manual runs, tests) passes through; filter only when it is explicit.
if (input.tool_name && !MUTATING_TOOLS.has(input.tool_name)) process.exit(0);

const filePath = input.tool_input?.file_path ?? '';
if (!TARGET_EXT.test(filePath)) process.exit(0);

const cwd = input.cwd || process.cwd();
const fcPath = findFeContext(cwd);
if (!fcPath) process.exit(0); // project without fe-context → no-op (universality)

let feContext;
try {
  feContext = readFileSync(fcPath, 'utf8');
} catch {
  process.exit(0); // unreadable (directory, permissions, …) → a check-only hook never blocks the session (fail-open)
}
const tokensPathMatch = feContext.match(/^tokensPath:\s*(\S+)/m);
if (!tokensPathMatch) process.exit(0); // no token system declared → no-op

// Path anchoring is unified on the single cwd the hook contract provides. Absolute filePaths stay as is.
const projectRoot = path.dirname(path.dirname(fcPath));
const resolved = path.resolve(cwd, filePath);

// Never read files outside the project — the hook must not leak unrelated file contents into context.
if (resolved !== projectRoot && !resolved.startsWith(projectRoot + path.sep)) process.exit(0);

// The token definition file itself legitimately holds raw values — excluded.
// Whole-directory exclusion applies only to token-"dedicated" directories (name contains "token") —
// preventing non-token files from escaping the check when tokens are declared in a shared
// directory (e.g. src/styles/).
const tokensFile = path.resolve(projectRoot, tokensPathMatch[1]);
const tokensDir = path.dirname(tokensFile);
const dirIsTokenOnly = /token/i.test(path.basename(tokensDir));
if (resolved === tokensFile || (dirIsTokenOnly && resolved.startsWith(tokensDir + path.sep))) {
  process.exit(0);
}

let source = '';
try {
  source = readFileSync(resolved, 'utf8');
} catch {
  process.exit(0);
}

const originalLines = source.split('\n');
const hits = [];
let total = 0;

maskNonColorRegions(source)
  .split('\n')
  .forEach((line, index) => {
    if (SUPPRESSION.test(originalLines[index] ?? '')) return;
    const count = countViolations(line);
    if (count === 0) return;
    total += count;
    hits.push(`L${index + 1}: ${(originalLines[index] ?? '').trim().slice(0, 80)}`);
  });

if (total === 0) process.exit(0);

const scope = hits.length === 1 ? '' : ` (across ${hits.length} lines)`;
const context = [
  `[omj:check-design-tokens] detected ${total} hardcoded color(s)${scope} in ${path.basename(resolved)} — prefer semantic values from the project tokens (${tokensPathMatch[1]}):`,
  ...hits.slice(0, 5),
  hits.length > 5 ? `… and ${hits.length - 5} more line(s)` : '',
  'False positive? Silence that line with an `omj-allow-color` comment.',
]
  .filter(Boolean)
  .join('\n');

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context },
  }),
);
process.exit(0);
