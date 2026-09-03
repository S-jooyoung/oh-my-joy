#!/usr/bin/env node
/**
 * eval-runner.mjs — behavioral evals for OMJ commands.
 *
 * Prefers Claude Code's native `claude plugin eval` (early access, enabled per
 * organization). When the native command reports early access, this script runs
 * the same case files itself: it copies a fixture into a temporary workspace,
 * drives `claude -p --plugin-dir <repo> --output-format stream-json`, scores the
 * graders it understands (regex · tool_used · tool_order · file_exists · llm),
 * and writes an aggregate-result.json in the native shape. One case format, two
 * runners — when early access lands, nothing has to be rewritten.
 *
 * Usage: node scripts/eval-runner.mjs [--case <glob>] [--tag <tag>] [--runs N]
 *        [--model <model>] [--judge-model <model>] [--threshold 0..1]
 *        [--max-cost-usd <usd>] [--json [path]] [--output-dir <dir>]
 *        [--eval-dir <dir>] [--no-scaffold] [--native | --fallback]
 *
 * Exit codes: 0 every case at or above the threshold · 1 below the threshold or a
 * load error · 2 the cost ceiling was hit (partial results written).
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- arguments ---------------------------------------------------------------

function parseArgs(argv) {
  const args = { evalDir: 'evals', threshold: 0.8, scaffold: true, json: null, cases: [], tags: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--case') args.cases.push(next());
    else if (a === '--tag') args.tags.push(next());
    else if (a === '--runs') args.runs = Number(next());
    else if (a === '--model') args.model = next();
    else if (a === '--judge-model') args.judgeModel = next();
    else if (a === '--threshold') args.threshold = Number(next());
    else if (a === '--max-cost-usd') args.maxCostUsd = Number(next());
    else if (a === '--output-dir') args.outputDir = next();
    else if (a === '--eval-dir') args.evalDir = next();
    else if (a === '--no-scaffold') args.scaffold = false;
    else if (a === '--native') args.mode = 'native';
    else if (a === '--fallback') args.mode = 'fallback';
    else if (a === '--json') args.json = argv[i + 1] && !argv[i + 1].startsWith('--') ? next() : '-';
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

// --- native detection ----------------------------------------------------------

function nativeAvailable() {
  const probeDir = mkdtempSync(path.join(tmpdir(), 'omj-eval-probe-'));
  try {
    const result = spawnSync('claude', ['plugin', 'eval'], { cwd: probeDir, encoding: 'utf8' });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.error) return false;
    return !/early access/i.test(output);
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
}

function runNative(args) {
  const passthrough = ['plugin', 'eval', REPO_ROOT, '--threshold', String(args.threshold), '--eval-dir', args.evalDir];
  for (const c of args.cases) passthrough.push('--case', c);
  for (const t of args.tags) passthrough.push('--tag', t);
  if (args.runs) passthrough.push('--runs', String(args.runs));
  if (args.model) passthrough.push('--model', args.model);
  if (args.judgeModel) passthrough.push('--judge-model', args.judgeModel);
  if (args.maxCostUsd) passthrough.push('--max-cost-usd', String(args.maxCostUsd));
  if (args.outputDir) passthrough.push('--output-dir', args.outputDir);
  if (args.json) passthrough.push('--json', ...(args.json === '-' ? [] : [args.json]));
  if (args.scaffold) passthrough.push('--scaffold');
  const result = spawnSync('claude', passthrough, { cwd: REPO_ROOT, stdio: 'inherit' });
  return result.status ?? 1;
}

// --- case loading --------------------------------------------------------------

/** Minimal YAML subset: scalars, quoted scalars, inline [a, b] lists, `- item` lists. */
function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) return { fields: {}, body: source };
  const fields = {};
  let listKey = null;
  for (const raw of match[1].split('\n')) {
    if (!raw.trim()) continue;
    const item = /^\s+-\s+(.*)$/.exec(raw);
    if (item && listKey) {
      fields[listKey].push(unquote(item[1]));
      continue;
    }
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(raw);
    if (!pair) throw new Error(`unsupported frontmatter line: ${raw}`);
    const [, key, value] = pair;
    if (value === '') {
      listKey = key;
      fields[key] = [];
    } else if (/^\[.*\]$/.test(value.trim())) {
      listKey = null;
      fields[key] = splitInlineList(value.trim().slice(1, -1));
    } else {
      listKey = null;
      fields[key] = unquote(value);
    }
  }
  return { fields, body: match[2].trim() };
}

function unquote(value) {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function splitInlineList(inner) {
  const items = [];
  let current = '';
  let quote = null;
  for (const ch of inner) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ',') {
      if (current.trim()) items.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function loadCases(evalDir, filters) {
  const root = path.join(REPO_ROOT, evalDir);
  if (!existsSync(root)) throw new Error(`eval dir not found: ${evalDir}`);
  const cases = [];
  for (const entry of readdirSync(root).sort()) {
    const dir = path.join(root, entry);
    if (!statSync(dir).isDirectory() || entry === 'fixtures' || entry === 'results' || entry === 'mocks') continue;
    const promptPath = path.join(dir, 'prompt.md');
    if (!existsSync(promptPath)) continue;
    const { fields, body } = parseFrontmatter(readFileSync(promptPath, 'utf8'));
    const name = fields.name ?? entry;
    if (filters.cases.length && !filters.cases.some((glob) => globMatch(glob, name))) continue;
    if (filters.tags.length && !(fields.tags ?? []).some((t) => filters.tags.includes(t))) continue;
    const gradersDir = path.join(dir, 'graders');
    const graders = existsSync(gradersDir)
      ? readdirSync(gradersDir)
          .filter((f) => f.endsWith('.md'))
          .sort()
          .map((f) => {
            const parsed = parseFrontmatter(readFileSync(path.join(gradersDir, f), 'utf8'));
            return { name: f.replace(/\.md$/, ''), ...parsed.fields, body: parsed.body };
          })
      : [];
    cases.push({ name, dir, fields, prompt: body, graders });
  }
  return cases;
}

function globMatch(glob, value) {
  const re = new RegExp(`^${glob.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return re.test(value);
}

// --- running one case -----------------------------------------------------------

function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules') continue;
    const full = path.join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) out.push(...listFiles(full, rel));
    else out.push(rel);
  }
  return out;
}

function runCase(testCase, args, budget) {
  const workspace = mkdtempSync(path.join(tmpdir(), `omj-eval-${testCase.name}-`));
  try {
    if (args.scaffold && testCase.fields.scaffold_script) {
      const scaffold = spawnSync('bash', ['-euo', 'pipefail', '-c', testCase.fields.scaffold_script], {
        cwd: workspace,
        env: { ...process.env, EVAL_FIXTURES: path.join(REPO_ROOT, args.evalDir, 'fixtures') },
        encoding: 'utf8',
      });
      if (scaffold.status !== 0) throw new Error(`scaffold failed for ${testCase.name}: ${scaffold.stderr}`);
    }
    const before = new Set(listFiles(workspace));

    const cli = ['-p', testCase.prompt, '--plugin-dir', REPO_ROOT, '--output-format', 'stream-json', '--verbose'];
    const allowed = testCase.fields.allowed_tools ?? [];
    if (allowed.length) cli.push('--allowedTools', ...allowed);
    if (testCase.fields.max_turns) cli.push('--max-turns', String(testCase.fields.max_turns));
    const model = args.model ?? testCase.fields.model;
    if (model) cli.push('--model', model);
    if (testCase.fields.append_system_prompt_file) {
      cli.push('--append-system-prompt-file', path.join(REPO_ROOT, testCase.fields.append_system_prompt_file));
    }
    const timeout = Number(testCase.fields.timeout_seconds ?? 300) * 1000;
    const run = spawnSync('claude', cli, { cwd: workspace, encoding: 'utf8', input: '', timeout, maxBuffer: 64 * 1024 * 1024 });

    const toolCalls = [];
    const assistantText = [];
    let lastMessage = '';
    let cost = 0;
    for (const line of (run.stdout ?? '').split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'assistant') {
        for (const block of event.message?.content ?? []) {
          if (block.type === 'tool_use') toolCalls.push({ name: block.name, input: JSON.stringify(block.input ?? {}) });
          if (block.type === 'text') assistantText.push(block.text);
        }
      }
      if (event.type === 'result') {
        lastMessage = typeof event.result === 'string' ? event.result : assistantText.at(-1) ?? '';
        cost = Number(event.total_cost_usd ?? 0);
      }
    }
    if (!lastMessage) lastMessage = assistantText.at(-1) ?? '';
    budget.spent += cost;

    const after = listFiles(workspace).filter((f) => !before.has(f));
    const context = { lastMessage, trace: JSON.stringify({ toolCalls, assistantText }), files: after, toolCalls, workspace };
    const graded = testCase.graders.map((grader) => gradeOne(grader, context, args, budget));
    const scored = graded.filter((g) => g.score !== null);
    const score = scored.length ? scored.reduce((s, g) => s + g.score, 0) / scored.length : 0;
    return {
      graders: graded,
      score,
      passed: score >= args.threshold,
      cost,
      exitCode: run.status,
      timedOut: Boolean(run.error && run.error.code === 'ETIMEDOUT'),
      lastMessage,
    };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function gradeOne(grader, context, args, budget) {
  const type = grader.type ?? 'regex';
  try {
    if (type === 'regex') {
      const target = grader.target === 'trace' ? context.trace : grader.target === 'files' ? context.files.join('\n') : context.lastMessage;
      const re = new RegExp(grader.pattern, grader.flags ?? '');
      const mode = grader.match ?? 'contains';
      let pass;
      if (mode === 'not_contains') pass = !re.test(target);
      else if (mode.startsWith('count:')) pass = (target.match(new RegExp(grader.pattern, `${grader.flags ?? ''}g`)) ?? []).length >= Number(mode.slice(6));
      else pass = re.test(target);
      return { name: grader.name, type, score: pass ? 1 : 0, details: pass ? 'matched' : `no match for /${grader.pattern}/` };
    }
    if (type === 'tool_used') {
      const inputRe = grader.input_match ? new RegExp(grader.input_match) : null;
      const count = context.toolCalls.filter((c) => c.name === grader.tool && (!inputRe || inputRe.test(c.input))).length;
      const min = grader.min !== undefined ? Number(grader.min) : grader.max !== undefined ? 0 : 1;
      const max = grader.max !== undefined ? Number(grader.max) : Infinity;
      const pass = count >= min && count <= max;
      return { name: grader.name, type, score: pass ? 1 : 0, details: `${grader.tool} called ${count}× (min ${min}, max ${max === Infinity ? '∞' : max})` };
    }
    if (type === 'tool_order') {
      const first = context.toolCalls.findIndex((c) => c.name === grader.before);
      const second = context.toolCalls.findIndex((c) => c.name === grader.after);
      const pass = first !== -1 && second !== -1 && first < second;
      return { name: grader.name, type, score: pass ? 1 : 0, details: pass ? 'ordered' : `${grader.before}@${first} vs ${grader.after}@${second}` };
    }
    if (type === 'file_exists') {
      const pass = context.files.some((f) => globMatch(grader.path, f)) || existsSync(path.join(context.workspace, grader.path));
      return { name: grader.name, type, score: pass ? 1 : 0, details: pass ? 'exists' : `${grader.path} not created` };
    }
    if (type === 'llm') {
      if (args.maxCostUsd && budget.spent >= args.maxCostUsd) {
        return { name: grader.name, type, score: null, details: 'skipped — cost ceiling reached' };
      }
      const judgePrompt = [
        'You are grading an AI coding assistant\'s final answer against a rubric. Reply with JSON only: {"pass": true|false, "reason": "<one sentence>"}.',
        '',
        '<rubric>',
        grader.criteria ?? grader.body,
        '</rubric>',
        '',
        '<answer>',
        context.lastMessage.slice(0, 20000),
        '</answer>',
      ].join('\n');
      const judge = spawnSync('claude', ['-p', judgePrompt, '--output-format', 'json', '--model', args.judgeModel ?? 'haiku', '--max-turns', '1'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        input: '',
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
      });
      let verdict = { pass: false, reason: 'judge produced no parseable verdict' };
      try {
        // `--output-format json` returns the event list (system · assistant · result)
        // on current CLIs and a single result envelope on older ones — accept both.
        const parsed = JSON.parse(judge.stdout);
        const envelope = Array.isArray(parsed) ? parsed.find((e) => e.type === 'result') ?? {} : parsed;
        budget.spent += Number(envelope.total_cost_usd ?? 0);
        const text = typeof envelope.result === 'string' ? envelope.result : '';
        const json = text.match(/\{[\s\S]*?\}/)?.[0];
        if (json) verdict = JSON.parse(json);
      } catch {
        /* fall through with the default verdict */
      }
      return { name: grader.name, type, score: verdict.pass ? 1 : 0, details: verdict.reason };
    }
    return { name: grader.name, type, score: null, details: `grader type "${type}" is not supported by the fallback runner` };
  } catch (error) {
    return { name: grader.name, type, score: 0, details: `grader error: ${error.message}` };
  }
}

// --- main ----------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).join('\n'));
    return 0;
  }
  const useNative = args.mode === 'native' || (args.mode !== 'fallback' && nativeAvailable());
  if (useNative) {
    console.error('eval-runner: native `claude plugin eval` available — delegating');
    return runNative(args);
  }
  console.error('eval-runner: native plugin eval not enabled — running the fallback runner (claude -p)');

  const cases = loadCases(args.evalDir, args);
  if (!cases.length) {
    console.error('eval-runner: no eval cases found');
    return 1;
  }
  const budget = { spent: 0 };
  const results = [];
  let ceilingHit = false;
  for (const testCase of cases) {
    const runs = args.runs ?? Number(testCase.fields.runs ?? 3);
    const arms = [];
    for (let i = 0; i < runs; i++) {
      if (args.maxCostUsd && budget.spent >= args.maxCostUsd) {
        ceilingHit = true;
        break;
      }
      const run = runCase(testCase, args, budget);
      arms.push(run);
      console.error(`  ${testCase.name} run ${i + 1}/${runs}: ${run.score.toFixed(2)}${run.timedOut ? ' (timed out)' : ''}`);
    }
    const score = arms.length ? arms.reduce((s, r) => s + r.score, 0) / arms.length : 0;
    results.push({ name: testCase.name, score, passed: arms.length > 0 && score >= args.threshold, arms });
    if (ceilingHit) break;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = args.outputDir ?? path.join(REPO_ROOT, args.evalDir, 'results', stamp);
  mkdirSync(outDir, { recursive: true });
  const aggregate = {
    schemaVersion: '1.1',
    runner: 'fallback',
    generatedAt: new Date().toISOString(),
    threshold: args.threshold,
    suite: { cases: results.map((r) => r.name) },
    cases: results.map((r) => ({
      name: r.name,
      score: r.score,
      passed: r.passed,
      arms: { with: r.arms.map((a) => ({ graders: a.graders, passed: a.passed, cost: a.cost, aborted: a.timedOut ? 'timeout' : null })) },
    })),
    aggregates: {
      passRate: results.length ? results.filter((r) => r.passed).length / results.length : 0,
      meanScore: results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0,
      costUsd: budget.spent,
      ceilingHit,
    },
  };
  writeFileSync(path.join(outDir, 'aggregate-result.json'), `${JSON.stringify(aggregate, null, 2)}\n`);
  if (args.json === '-') process.stdout.write(`${JSON.stringify(aggregate, null, 2)}\n`);
  else if (args.json) writeFileSync(args.json, `${JSON.stringify(aggregate, null, 2)}\n`);

  console.log('');
  console.log('case                         score   verdict');
  for (const r of results) console.log(`${r.name.padEnd(28)} ${r.score.toFixed(2).padStart(5)}   ${r.passed ? 'pass' : 'FAIL'}`);
  console.log(`\npass rate ${(aggregate.aggregates.passRate * 100).toFixed(0)}% · mean ${aggregate.aggregates.meanScore.toFixed(2)} · cost $${budget.spent.toFixed(2)} · results ${path.relative(REPO_ROOT, outDir)}`);

  if (ceilingHit) return 2;
  return results.every((r) => r.passed) ? 0 : 1;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`eval-runner: ${error.message}`);
  process.exit(1);
}
