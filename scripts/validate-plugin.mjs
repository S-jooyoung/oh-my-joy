#!/usr/bin/env node
/**
 * validate-plugin — checks the two manifests against the Claude Code plugin spec.
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

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

  // skills/<name>/SKILL.md is the only layout Claude Code discovers.
  const skillsDir = repoPath('skills');
  if (!existsSync(skillsDir)) return;
  for (const name of readdirSync(skillsDir)) {
    const dir = path.join(skillsDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const skillFile = path.join(dir, 'SKILL.md');
    if (!existsSync(skillFile)) {
      fail(`skills/${name}: SKILL.md is missing — the directory will not be discovered`);
      continue;
    }
    const keys = parseFrontmatterKeys(readFileSync(skillFile, 'utf8'));
    if (!keys) {
      fail(`skills/${name}/SKILL.md: missing YAML frontmatter`);
      continue;
    }
    for (const key of keys) {
      if (!SKILL_FRONTMATTER_FIELDS.has(key)) fail(`skills/${name}/SKILL.md: unknown frontmatter field "${key}"`);
    }
    if (!keys.includes('description')) fail(`skills/${name}/SKILL.md: "description" is required`);
  }
}

/** The repo's own invariant: shipping hooks.json would auto-fire hooks everywhere. */
function checkNoShippedHooks() {
  if (existsSync(repoPath('hooks', 'hooks.json'))) {
    fail('hooks/hooks.json exists — the plugin must never ship auto-firing hooks (they are opt-in via /omj-setup)');
  }
}

// ---------------------------------------------------------------------------

const plugin = checkPluginManifest();
checkMarketplaceManifest(plugin);
checkComponentFrontmatter();
checkNoShippedHooks();
notes.push('built-in schema check: manifests, command/agent/skill frontmatter, hooks invariant');

if (cliAvailable()) {
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
