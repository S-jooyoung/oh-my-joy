#!/usr/bin/env node
/**
 * validate-plugin — checks the Claude Code and Codex plugin surfaces.
 *
 * Two layers, deliberately:
 *
 * 1. **`claude plugin validate --strict`**, when the CLI is on PATH. This is the
 *    authority: it tracks the spec as the runtime actually implements it, so it
 *    catches field renames and new requirements this repo would otherwise learn
 *    about from a broken install.
 * 2. **A built-in schema check** that always runs. CI must not silently degrade to
 *    "no validation" on a runner without the CLI, and contributors should get the
 *    same verdict without installing Claude Code first.
 *
 * The field tables come from the official reference
 * (https://code.claude.com/docs/en/plugins-reference and /plugin-marketplaces).
 * Unknown fields are errors, not warnings: a typo'd key is silently ignored at
 * load time, which is exactly the failure this script exists to surface.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `--root <dir>` points the checks at another plugin tree, and `--skip-cli`
 * suppresses layer 1. Both exist so the test suite can validate purpose-built
 * fixtures — a check that is never shown a broken manifest is indistinguishable
 * from one that always passes. Neither flag is used in normal operation.
 */
const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
const SKIP_CLI = args.includes('--skip-cli');

const REPO_ROOT =
  rootFlag !== -1 && args[rootFlag + 1]
    ? path.resolve(args[rootFlag + 1])
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const repoPath = (...segments) => path.join(REPO_ROOT, ...segments);
const readJson = (...segments) => JSON.parse(readFileSync(repoPath(...segments), 'utf8'));

const errors = [];
const notes = [];
const fail = (message) => errors.push(message);

/**
 * The one warning this repo accepts from `--strict`, matched on its stable
 * substring.
 *
 * `CLAUDE.md` at the root is **not** plugin content — it is the operating manual
 * for contributors working *in* this repo, which is why it must stay at the root
 * where Claude Code loads it as project context. The CLI's advice ("ship it as a
 * skill instead") applies to plugins that intend to ship context to consuming
 * projects; this one deliberately ships none.
 *
 * Scoped to this exact text on purpose: any *other* warning still fails the run.
 */
const ACCEPTED_WARNINGS = ['CLAUDE.md at the plugin root is not loaded as project context'];

// ---------------------------------------------------------------------------
// Layer 1 — the official CLI
// ---------------------------------------------------------------------------

function runCli(manifestPath) {
  let output;
  let failed = false;
  try {
    output = execFileSync('claude', ['plugin', 'validate', manifestPath, '--strict'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    failed = true;
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }

  const warnings = [...output.matchAll(/❯\s+(.+)/g)].map((m) => m[1].trim());
  const unexpected = warnings.filter((w) => !ACCEPTED_WARNINGS.some((accepted) => w.includes(accepted)));

  if (unexpected.length > 0) {
    for (const warning of unexpected) fail(`claude plugin validate (${path.basename(manifestPath)}): ${warning}`);
    return;
  }
  if (failed && warnings.length === 0) {
    fail(`claude plugin validate (${path.basename(manifestPath)}) failed:\n${output.trim()}`);
    return;
  }
  const accepted = warnings.length > 0 ? ` (${warnings.length} accepted warning(s))` : '';
  notes.push(`claude plugin validate --strict: ${path.basename(manifestPath)} OK${accepted}`);
}

function cliAvailable() {
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Layer 2 — built-in schema check
// ---------------------------------------------------------------------------

const PLUGIN_FIELDS = new Set([
  '$schema', 'name', 'displayName', 'version', 'description', 'author', 'homepage',
  'repository', 'license', 'keywords', 'metadata', 'defaultEnabled', 'skills', 'commands',
  'agents', 'workflows', 'hooks', 'mcpServers', 'outputStyles', 'lspServers', 'experimental',
  'userConfig', 'channels', 'dependencies',
]);

const MARKETPLACE_FIELDS = new Set([
  '$schema', 'name', 'owner', 'plugins', 'description', 'version', 'metadata',
  'allowCrossMarketplaceDependenciesOn', 'renames',
]);

const MARKETPLACE_PLUGIN_FIELDS = new Set([
  'name', 'source', 'displayName', 'description', 'version', 'author', 'homepage',
  'repository', 'license', 'keywords', 'metadata', 'category', 'tags', 'strict',
  'relevance', 'defaultEnabled', 'skills', 'commands', 'agents', 'hooks', 'mcpServers',
  'lspServers',
]);

/** Frontmatter keys Claude Code accepts on a skill / flat command file. */
const SKILL_FRONTMATTER_FIELDS = new Set([
  'name', 'description', 'argument-hint', 'disable-model-invocation', 'allowed-tools',
  'disallowed-tools', 'model', 'context', 'background', 'agent', 'arguments', 'shell',
  'user-invocable', 'metadata', 'license', 'compatibility', 'paths',
]);

/** Frontmatter keys Claude Code accepts on an agent file. */
const AGENT_FRONTMATTER_FIELDS = new Set([
  'name', 'description', 'model', 'effort', 'maxTurns', 'tools', 'disallowedTools',
  'skills', 'memory', 'background', 'isolation',
]);

/** Plugin-shipped agents cannot carry these (security restriction in the spec). */
const AGENT_FORBIDDEN_FIELDS = ['hooks', 'mcpServers', 'permissionMode'];

/** Codex plugin manifest fields used by the published plugin schema. */
const CODEX_PLUGIN_FIELDS = new Set([
  '$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository',
  'license', 'keywords', 'skills', 'mcpServers', 'hooks', 'apps', 'interface',
]);

const EXPECTED_CODEX_ADAPTERS = [
  'critic', 'deep-interview', 'design-qa', 'fix', 'implementer', 'ralplan', 'review',
  'setup', 'ship', 'spec', 'sync', 'ultragoal', 'verify',
];

// These identifiers belong to Claude's tool/runtime surface. Natural-language
// references to Claude are legal, but an adapter containing one of these tokens
// cannot execute as written in Codex.
const CLAUDE_ONLY_CODEX_TOKENS = [
  ['AskUserQuestion', /\bAskUserQuestion\b/],
  ['ExitPlanMode', /\bExitPlanMode\b/],
  ['CLAUDE_PLUGIN_ROOT', /\bCLAUDE_PLUGIN_ROOT\b/],
  ['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', /\bCLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\b/],
  ['mcp__plugin_*', /\bmcp__plugin_[A-Za-z0-9_-]+__/],
];

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkUnknownFields(object, allowed, label) {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) fail(`${label}: unknown field "${key}" — it is ignored at load time`);
  }
}

function checkPluginManifest() {
  const plugin = readJson('.claude-plugin', 'plugin.json');
  checkUnknownFields(plugin, PLUGIN_FIELDS, 'plugin.json');

  if (!plugin.name) fail('plugin.json: "name" is required');
  else if (!KEBAB_CASE.test(plugin.name)) fail(`plugin.json: "name" must be kebab-case (got "${plugin.name}")`);

  if (plugin.author && !plugin.author.name) fail('plugin.json: author.name is required when author is present');
  return plugin;
}

function checkCodexManifest(claudePlugin) {
  const manifestPath = repoPath('.codex-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) {
    fail('.codex-plugin/plugin.json is required for Codex installation');
    return null;
  }

  const codex = readJson('.codex-plugin', 'plugin.json');
  checkUnknownFields(codex, CODEX_PLUGIN_FIELDS, '.codex-plugin/plugin.json');

  for (const field of ['name', 'version', 'description', 'author', 'license', 'skills']) {
    if (!codex[field]) fail(`.codex-plugin/plugin.json: "${field}" is required`);
  }
  if (codex.name && !KEBAB_CASE.test(codex.name)) {
    fail(`.codex-plugin/plugin.json: "name" must be kebab-case (got "${codex.name}")`);
  }
  if (codex.author && !codex.author.name) {
    fail('.codex-plugin/plugin.json: author.name is required when author is present');
  }
  if (codex.name && claudePlugin.name && codex.name !== claudePlugin.name) {
    fail(`name mismatch: Claude plugin ${claudePlugin.name} vs Codex plugin ${codex.name}`);
  }
  if (codex.version && claudePlugin.version && codex.version !== claudePlugin.version) {
    fail(`version mismatch: Claude plugin ${claudePlugin.version} vs Codex plugin ${codex.version}`);
  }
  if (codex.skills !== './skills/') {
    fail('.codex-plugin/plugin.json: "skills" must be "./skills/" (the canonical Codex plugin skill path)');
  }
  return codex;
}

function checkMarketplaceManifest(plugin) {
  const marketplace = readJson('.claude-plugin', 'marketplace.json');
  checkUnknownFields(marketplace, MARKETPLACE_FIELDS, 'marketplace.json');

  if (!marketplace.name) fail('marketplace.json: "name" is required');
  else if (!KEBAB_CASE.test(marketplace.name)) {
    fail(`marketplace.json: "name" must be kebab-case (got "${marketplace.name}")`);
  }
  if (!marketplace.owner?.name) fail('marketplace.json: owner.name is required');
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    fail('marketplace.json: "plugins" must be a non-empty array');
    return;
  }

  for (const entry of marketplace.plugins) {
    const label = `marketplace.json plugins["${entry.name ?? '?'}"]`;
    checkUnknownFields(entry, MARKETPLACE_PLUGIN_FIELDS, label);
    if (!entry.name) fail(`${label}: "name" is required`);
    if (!entry.source) fail(`${label}: "source" is required`);

    if (typeof entry.source === 'string' && entry.source.startsWith('.')) {
      const resolved = path.resolve(REPO_ROOT, entry.source);
      if (!existsSync(resolved)) fail(`${label}: source "${entry.source}" does not exist`);
      if (!resolved.startsWith(REPO_ROOT)) fail(`${label}: source "${entry.source}" escapes the repo root`);
    }
  }

  // The install string users are told to run resolves to this pair.
  const entry = marketplace.plugins.find((p) => p.name === plugin.name);
  if (!entry) {
    fail(`marketplace.json: no entry named "${plugin.name}" — /plugin install ${plugin.name}@${marketplace.name} would not resolve`);
  } else if (entry.version && plugin.version && entry.version !== plugin.version) {
    fail(`version mismatch: plugin.json ${plugin.version} vs marketplace entry ${entry.version}`);
  }
}

function parseFrontmatterKeys(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (!match) return null;
  return match[1]
    .split('\n')
    .filter((line) => line.trim() && !/^\s/.test(line))
    .map((line) => /^([A-Za-z0-9_-]+):/.exec(line)?.[1])
    .filter(Boolean);
}

function checkComponentFrontmatter() {
  const surfaces = [
    { dir: 'commands', allowed: SKILL_FRONTMATTER_FIELDS, forbidden: [] },
    { dir: 'agents', allowed: AGENT_FRONTMATTER_FIELDS, forbidden: AGENT_FORBIDDEN_FIELDS },
  ];

  for (const { dir, allowed, forbidden } of surfaces) {
    if (!existsSync(repoPath(dir))) continue; // an absent component directory is legal
    for (const file of readdirSync(repoPath(dir)).filter((f) => f.endsWith('.md'))) {
      const keys = parseFrontmatterKeys(readFileSync(repoPath(dir, file), 'utf8'));
      if (!keys) {
        fail(`${dir}/${file}: missing YAML frontmatter`);
        continue;
      }
      for (const key of keys) {
        if (forbidden.includes(key)) {
          fail(`${dir}/${file}: "${key}" is not allowed on a plugin-shipped agent (spec restriction)`);
        } else if (!allowed.has(key)) {
          fail(`${dir}/${file}: unknown frontmatter field "${key}"`);
        }
      }
      if (!keys.includes('description')) fail(`${dir}/${file}: "description" is required`);
    }
  }

  // Both providers discover <root>/<name>/SKILL.md. Codex requires the canonical
  // skills/ root; adapter frontmatter below keeps those entries inert in Claude.
  for (const root of ['skills']) {
    const skillsDir = repoPath(root);
    if (!existsSync(skillsDir)) continue;
    for (const name of readdirSync(skillsDir)) {
      const dir = path.join(skillsDir, name);
      if (!statSync(dir).isDirectory()) continue;
      const skillFile = path.join(dir, 'SKILL.md');
      if (!existsSync(skillFile)) {
        fail(`${root}/${name}: SKILL.md is missing — the directory will not be discovered`);
        continue;
      }
      const keys = parseFrontmatterKeys(readFileSync(skillFile, 'utf8'));
      if (!keys) {
        fail(`${root}/${name}/SKILL.md: missing YAML frontmatter`);
        continue;
      }
      for (const key of keys) {
        if (!SKILL_FRONTMATTER_FIELDS.has(key)) fail(`${root}/${name}/SKILL.md: unknown frontmatter field "${key}"`);
      }
      if (!keys.includes('description')) fail(`${root}/${name}/SKILL.md: "description" is required`);
    }
  }
}

function skillBody(source) {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

function hasNoMutationBoundary(body) {
  return /\b(?:do not|must not|never|without)\b[^\n]{0,120}\b(?:modify|edit|write|mutat|change)\w*\b[^\n]{0,80}\b(?:source|repo(?:sitory)?|project|file)s?\b/i.test(body)
    || /\b(?:read[- ]only|no[- ]mutation|non[- ]mutating)\b/i.test(body);
}

function checkCodexSkills() {
  const adaptersDir = repoPath('skills');
  if (!existsSync(adaptersDir)) {
    fail('skills/: Codex skill directory is missing');
    return;
  }

  const actual = readdirSync(adaptersDir)
    .filter((name) => statSync(path.join(adaptersDir, name)).isDirectory())
    .sort();
  const expected = [...EXPECTED_CODEX_ADAPTERS, 'frontend-fundamentals'].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`skills/: expected exactly ${expected.join(', ')} (got ${actual.join(', ')})`);
  }

  const sources = new Map();
  const completeSources = new Map();
  for (const name of EXPECTED_CODEX_ADAPTERS) {
    const file = path.join(adaptersDir, name, 'SKILL.md');
    if (!existsSync(file)) continue; // checkComponentFrontmatter reports this precisely
    const source = readFileSync(file, 'utf8');
    const keys = parseFrontmatterKeys(source);
    if (keys && !keys.includes('name')) fail(`skills/${name}/SKILL.md: "name" is required for Codex discovery`);
    const nameMatch = /^---\r?\n[\s\S]*?^name:\s*["']?([^\r\n"']+)["']?\s*$/m.exec(source);
    if (nameMatch && nameMatch[1].trim() !== name) {
      fail(`skills/${name}/SKILL.md: name "${nameMatch[1].trim()}" must match its directory`);
    }

    const body = skillBody(source);
    sources.set(name, body);
    completeSources.set(name, source);
    for (const [label, pattern] of CLAUDE_ONLY_CODEX_TOKENS) {
      if (pattern.test(body)) fail(`skills/${name}/SKILL.md: Claude-only runtime token "${label}" is not valid in a Codex adapter`);
    }
  }

  for (const name of ['spec', 'ralplan', 'deep-interview']) {
    const body = sources.get(name);
    if (body && !hasNoMutationBoundary(body)) {
      fail(`skills/${name}/SKILL.md: must explicitly preserve a non-mutating repository/source boundary`);
    }
  }
  for (const name of ['review', 'verify']) {
    const body = sources.get(name);
    const reportOnly = /\b(?:reports?[- ]only|inspection[- ]only|source[- ]untouched)\b/i.test(completeSources.get(name) ?? '')
      || /\breview and report\s*;\s*never fix\b/i.test(body ?? '');
    if (body && !(hasNoMutationBoundary(body) && reportOnly)) {
      fail(`skills/${name}/SKILL.md: must explicitly be report-only and preserve a non-mutating repository/source boundary`);
    }
  }

  const ship = sources.get('ship');
  if (ship) {
    if (!/\bexplicit(?:ly)?\b[^\n]{0,80}\b(?:request\w*|instruction\w*|authoriz\w*|ask(?:ed)?)\b/i.test(ship)) {
      fail('skills/ship/SKILL.md: shipping must require an explicit user request');
    }
    if (!/(?:\bverif\w*\b[^\n]{0,100}\bbefore\b[^\n]{0,60}\bpush\w*\b)|(?:\bbefore\b[^\n]{0,60}\bpush\w*\b[^\n]{0,100}\bverif\w*\b)/i.test(ship)) {
      fail('skills/ship/SKILL.md: verification must complete before push');
    }
    if (!/\b(?:shared|protected|default) branch\b|\bdirect(?:ly)?\s+(?:commit|push)\b/i.test(ship)) {
      fail('skills/ship/SKILL.md: must guard against direct shipping from a shared/protected/default branch');
    }
  }
}

/** The repo's own invariant: shipping hooks.json would auto-fire hooks everywhere. */
function checkNoShippedHooks() {
  if (existsSync(repoPath('hooks', 'hooks.json'))) {
    fail('hooks/hooks.json exists — the plugin must never ship auto-firing hooks (they are opt-in via /oh-my-joy:setup)');
  }
}

// ---------------------------------------------------------------------------

const plugin = checkPluginManifest();
checkCodexManifest(plugin);
checkMarketplaceManifest(plugin);
checkComponentFrontmatter();
checkCodexSkills();
checkNoShippedHooks();
notes.push('built-in schema check: Claude/Codex manifests, exact Codex skills, frontmatter, safety boundaries, hooks invariant');

if (SKIP_CLI) {
  notes.push('--skip-cli — ran the built-in check only');
} else if (cliAvailable()) {
  runCli(repoPath('.claude-plugin', 'marketplace.json'));
  runCli(repoPath('.claude-plugin', 'plugin.json'));
} else {
  notes.push('claude CLI not on PATH — ran the built-in check only');
}

for (const note of notes) console.log(`  ✓ ${note}`);

if (errors.length > 0) {
  console.error(`\nvalidate-plugin: ${errors.length} problem(s)`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}
console.log('\nvalidate-plugin: OK');
