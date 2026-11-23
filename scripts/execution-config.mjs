import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const CROSS_REVIEW = ['off', 'preferred'];
const REMOVED_KEYS = ['leader', 'workers', 'runtime'];
export const DEFAULTS = Object.freeze({ maxWorkers: 2, crossReview: 'off', models: {} });

function crossReviewValue(value, source, warnings) {
  if (value === 'required') {
    warnings.push(`${source}: crossReview required was removed in 2.0; using preferred`);
    return 'preferred';
  }
  if (!CROSS_REVIEW.includes(value)) throw new Error(`${source}: invalid crossReview`);
  return value;
}

export function validateConfig(value, source = 'config', warnings = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${source}: expected an object`);
  const config = {};
  for (const [key, item] of Object.entries(value)) {
    if (REMOVED_KEYS.includes(key)) {
      warnings.push(`${source}: ${key} was removed in 2.0 and is ignored`);
      continue;
    }
    if (key === 'crossReview') {
      config[key] = crossReviewValue(item, source, warnings);
      continue;
    }
    if (key === 'maxWorkers') {
      if (!Number.isSafeInteger(item) || item < 1) throw new Error(`${source}: maxWorkers must be a positive integer`);
    } else if (key === 'models') {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${source}: models must be an object`);
      for (const [host, model] of Object.entries(item)) {
        if (!['codex', 'claude'].includes(host) || typeof model !== 'string' || !model.trim() || /[\r\n\0]/.test(model)) throw new Error(`${source}: invalid model selection`);
      }
    } else throw new Error(`${source}: unknown key ${key}`);
    config[key] = item;
  }
  return config;
}

export function resolveConfig({ personal = {}, project = {}, request = {}, legacyCrossReview } = {}) {
  const effective = { ...DEFAULTS, models: {} };
  const sources = Object.fromEntries(Object.keys(effective).map(key => [key, 'default']));
  const warnings = [];
  for (const [source, layer] of [['personal', personal], ['project', project], ['request', request]]) {
    for (const [key, value] of Object.entries(validateConfig(layer, source, warnings))) {
      effective[key] = key === 'models' ? { ...effective.models, ...value } : value;
      sources[key] = source;
    }
  }
  if (legacyCrossReview !== undefined) {
    const legacy = crossReviewValue(legacyCrossReview, 'fe-context', warnings);
    if (sources.crossReview === 'default' || sources.crossReview === 'personal') {
      effective.crossReview = legacy;
      sources.crossReview = 'fe-context';
    } else if (effective.crossReview !== legacy) {
      warnings.push(`crossReview conflict: ${sources.crossReview}=${effective.crossReview}, fe-context=${legacy}`);
    }
  }
  return { effective, sources, warnings };
}

export function loadConfig({ root, home = homedir(), request = {} }) {
  const files = { personal: path.join(home, '.config/oh-my-joy/config.json'), project: path.join(root, '.omj/config.json') };
  const read = file => {
    if (!existsSync(file)) return {};
    try { return JSON.parse(readFileSync(file, 'utf8')); } catch (error) { throw new Error(`${file}: ${error.message}`); }
  };
  const context = path.join(root, '.omj/fe-context.md');
  const declarations = existsSync(context) ? [...readFileSync(context, 'utf8').matchAll(/^crossReview:[ \t]*(.*)$/gm)].map(match => {
    const scalar = /^(off|preferred|required|'(?:off|preferred|required)'|"(?:off|preferred|required)")(?:\s+#.*)?$/.exec(match[1].trim());
    if (!scalar) throw new Error('fe-context: invalid crossReview');
    return scalar[1].replace(/^['"]|['"]$/g, '');
  }) : [];
  if (declarations.length > 1) throw new Error('fe-context: duplicate crossReview');
  return { ...resolveConfig({ personal: read(files.personal), project: read(files.project), request, legacyCrossReview: declarations[0] }), files };
}

export function executionRoute(facts) {
  if (facts.resume === true) return 'resume';
  if (facts.approvedPlan === true) return 'planned';
  if (facts.explicitPlanning === true) return 'plan';
  const safe = ['clearGoal', 'noSensitiveChange', 'noPublicContractChange', 'noExternalWrite'].every(key => facts[key] === true);
  const small = facts.deliverables === 1 && Number.isInteger(facts.targetFiles) && facts.targetFiles >= 0 && facts.targetFiles <= 5;
  return safe && small ? 'playbook' : 'plan';
}

export function dispatchCapacity({ maxWorkers, active, hostLimit = maxWorkers }) {
  validateConfig({ maxWorkers });
  if (!Number.isSafeInteger(hostLimit) || hostLimit < 0 || !Array.isArray(active)) throw new Error('invalid runtime snapshot');
  const ids = new Set();
  for (const worker of active) {
    if (!worker.id || ids.has(worker.id) || !['starting', 'running', 'waiting', 'unknown', 'stopped'].includes(worker.state)) throw new Error('invalid or duplicate worker snapshot');
    ids.add(worker.id);
  }
  const used = active.filter(worker => worker.state !== 'stopped').length;
  return Math.max(0, Math.min(maxWorkers, hostLimit) - used);
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && realpathSync(process.argv[1]) === self) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && !['--check', '--resolve', '--route', '--capacity'].includes(args[0]))) throw new Error('usage: node execution-config.mjs [--check|--resolve|--route|--capacity]');
    let root;
    try { root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { root = process.cwd(); }
    const input = args.length && args[0] !== '--check' ? JSON.parse(readFileSync(0, 'utf8')) : {};
    const result = args[0] === '--route' ? executionRoute(input)
      : args[0] === '--capacity' ? dispatchCapacity(input)
        : loadConfig({ root, request: input });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`execution-config: ${error.message}\n`);
    process.exitCode = 1;
  }
}
