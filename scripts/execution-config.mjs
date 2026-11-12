import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const choices = {
  leader: ['current', 'codex', 'claude'],
  workers: ['current', 'codex', 'claude', 'mixed'],
  runtime: ['auto', 'native', 'herdr', 'orca'],
  crossReview: ['off', 'preferred', 'required'],
};
export const DEFAULTS = Object.freeze({ leader: 'current', workers: 'current', maxWorkers: 2, runtime: 'auto', crossReview: 'off', models: {} });

export function validateConfig(value, source = 'config') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${source}: expected an object`);
  for (const [key, item] of Object.entries(value)) {
    if (Object.hasOwn(choices, key)) {
      if (!choices[key].includes(item)) throw new Error(`${source}: invalid ${key}`);
    } else if (key === 'maxWorkers') {
      if (!Number.isSafeInteger(item) || item < 1) throw new Error(`${source}: maxWorkers must be a positive integer`);
    } else if (key === 'models') {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${source}: models must be an object`);
      for (const [host, model] of Object.entries(item)) {
        if (!['codex', 'claude'].includes(host) || typeof model !== 'string' || !model.trim() || /[\r\n\0]/.test(model)) throw new Error(`${source}: invalid model selection`);
      }
    } else throw new Error(`${source}: unknown key ${key}`);
  }
  return value;
}

export function resolveConfig({ personal = {}, project = {}, request = {}, legacyCrossReview } = {}) {
  const effective = { ...DEFAULTS, models: {} };
  const sources = Object.fromEntries(Object.keys(effective).map(key => [key, 'default']));
  const warnings = [];
  for (const [source, layer] of [['personal', personal], ['project', project], ['request', request]]) {
    validateConfig(layer, source);
    for (const [key, value] of Object.entries(layer)) {
      effective[key] = key === 'models' ? { ...effective.models, ...value } : value;
      sources[key] = source;
    }
  }
  if (legacyCrossReview !== undefined) {
    if (!choices.crossReview.includes(legacyCrossReview)) throw new Error('fe-context: invalid crossReview');
    if (sources.crossReview === 'default' || sources.crossReview === 'personal') {
      effective.crossReview = legacyCrossReview;
      sources.crossReview = 'fe-context';
    } else if (effective.crossReview !== legacyCrossReview) {
      warnings.push(`crossReview conflict: ${sources.crossReview}=${effective.crossReview}, fe-context=${legacyCrossReview}`);
      if (legacyCrossReview === 'required') throw new Error('fe-context requires crossReview: required; resolve the conflict before execution');
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
  const safe = ['clearGoal', 'boundedLocalChange', 'knownVerification', 'singleHost', 'noPublicContractChange', 'noSensitiveChange', 'noExternalWrite'];
  return safe.every(key => facts[key] === true) ? 'direct' : 'plan';
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
