/**
 * Shared test helpers — repo path resolution, hook script execution, temp project fixtures.
 *
 * Zero dependencies (Node built-ins only). The plugin itself ships no runtime
 * dependencies, and the verification harness honors the same constraint so the
 * suite runs with plain `node --test`, no `npm i` required.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const repoPath = (...segments) => path.join(REPO_ROOT, ...segments);

export const readRepoFile = (...segments) => readFileSync(repoPath(...segments), 'utf8');

export const readJson = (...segments) => JSON.parse(readRepoFile(...segments));

/** Tracked files matching the given git pathspecs (committed surface only). */
export function listTrackedFiles(...patterns) {
  const out = execFileSync('git', ['ls-files', ...patterns], { cwd: REPO_ROOT, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

/** All markdown committed to the repo (test fixtures excluded). */
export const listMarkdownFiles = () => listTrackedFiles('*.md');

export const listCommandFiles = () =>
  readdirSync(repoPath('commands'))
    .filter((f) => f.endsWith('.md'))
    .sort();

export const listAgentFiles = () =>
  readdirSync(repoPath('agents'))
    .filter((f) => f.endsWith('.md'))
    .sort();

/**
 * Strips fenced code blocks and inline code. A `[text](path)` inside a code span
 * is an example *describing* a link, not a link — if the link checks matched it,
 * the docs would become unwritable.
 */
export const stripCode = (source) =>
  source.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

const unquote = (value) => value.trim().replace(/^"(.*)"$|^'(.*)'$/, (_m, d, s) => d ?? s);

/**
 * Parses markdown frontmatter. No YAML parser is pulled in — only the subset this
 * repo actually uses is handled: single-line `key: value`, `- item` lists, and
 * one level of nested mappings.
 *
 * **Anything beyond the supported syntax throws.** Silently dropping it would make
 * tests unable to distinguish "no value" from "the parser could not read it",
 * producing false confidence — the `metadata:` nested mapping being lost wholesale
 * was exactly that failure. Unsupported syntax such as block scalars (`>`/`|`)
 * fails loudly as a signal to extend the parser.
 */
export function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (!match) return null;

  const fields = {};
  let pendingKey = null; // last key with an empty value — the next indented line decides list vs mapping

  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;

    const indented = /^\s+(.*)$/.exec(line);
    if (indented) {
      if (!pendingKey) throw new Error(`Unsupported frontmatter indentation: ${line}`);

      const listItem = /^-\s+(.*)$/.exec(indented[1]);
      if (listItem) {
        if (!Array.isArray(fields[pendingKey])) fields[pendingKey] = [];
        fields[pendingKey].push(unquote(listItem[1]));
        continue;
      }

      const nested = /^([A-Za-z0-9_-]+):\s*(.+)$/.exec(indented[1]);
      if (!nested) throw new Error(`Unsupported frontmatter syntax: ${line}`);
      if (Array.isArray(fields[pendingKey]) && fields[pendingKey].length > 0) {
        throw new Error(`Cannot mix list and mapping: ${line}`);
      }
      if (!fields[pendingKey] || Array.isArray(fields[pendingKey])) fields[pendingKey] = {};
      fields[pendingKey][nested[1]] = unquote(nested[2]);
      continue;
    }

    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!pair) throw new Error(`Unsupported frontmatter syntax: ${line}`);

    const [, key, rawValue] = pair;
    if (rawValue.trim() === '') {
      pendingKey = key;
      fields[key] = [];
    } else if (/^[>|]/.test(rawValue.trim())) {
      throw new Error(`Block scalars are not supported (extend the parser): ${line}`);
    } else {
      pendingKey = null;
      fields[key] = unquote(rawValue);
    }
  }

  return fields;
}

/**
 * Runs a hook script as a real child process, feeding stdin JSON per the
 * PostToolUse contract. It is executed as a process rather than imported as a
 * function because the hook's contract surface IS stdin/stdout/exit code, and
 * that boundary is where regressions happen.
 * (`execFileSync` throws on abnormal exit, so crashes surface as test failures.)
 *
 * With `raw: true` the payload is sent as-is — required to reproduce unparseable
 * stdin. `JSON.stringify('not-json')` yields `"not-json"`, which is **valid
 * JSON**, so it alone never exercises the hook's parse-guard code.
 */
export function runHook(scriptName, payload, { raw = false } = {}) {
  const result = execFileSync('node', [repoPath('templates', 'hooks', scriptName)], {
    input: raw ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
  return {
    stdout: result,
    json: result.trim() ? JSON.parse(result) : null,
    context: result.trim() ? JSON.parse(result).hookSpecificOutput?.additionalContext ?? '' : '',
  };
}

/**
 * Creates a temp directory mimicking a consuming project.
 * files: { '<relative path>': '<contents>' } — the presence of `.omj/fe-context.md`
 * is what the gate checks are verified against.
 */
export function makeProject(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'omj-test-'));
  for (const [relative, contents] of Object.entries(files)) {
    const absolute = path.join(root, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }
  return {
    root,
    file: (relative) => path.join(root, relative),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** The stdin payload shape a PostToolUse hook actually receives. */
export const postToolUsePayload = ({ cwd, filePath, toolName = 'Edit' }) => ({
  session_id: 'test-session',
  transcript_path: '/dev/null',
  cwd,
  hook_event_name: 'PostToolUse',
  tool_name: toolName,
  tool_input: { file_path: filePath },
  tool_response: { success: true },
});
