#!/usr/bin/env node
/**
 * release — deterministic file transformer for a release cut (never touches git).
 *
 * Deployment-model premise (CONTRIBUTING "Release" section): the marketplace
 * serves main HEAD, but plugin.json `version` is the deployment gate, so the
 * moment a version bump merges IS the deployment. This script removes the
 * recurring accident of bumping the four surfaces by hand until they drift
 * (tests do catch it, but every round trip costs), plus the mechanical mistakes
 * in finalizing the CHANGELOG section and its two link lines.
 *
 * Ownership boundary: CHANGELOG **prose is written by humans** — this script
 * only performs the structural transform of moving [Unreleased] into a version
 * section and regenerating the empty skeleton (no entry generation, no
 * summarizing). It runs no git commands (except the read-only diff behind the
 * skills advisory), so a cut is always reviewed as a diff by a human before
 * committing. Tagging belongs to the release-tag.yml workflow.
 *
 *   cut   --version X.Y.Z [--date YYYY-MM-DD]  # finalize [Unreleased] + bump the 4 surfaces
 *   notes --version X.Y.Z                      # extract the section body (GitHub Release notes)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const CHANGELOG = 'CHANGELOG.md';
/** The four version surfaces — the same list tests/plugin-manifest.test.mjs keeps in lockstep. */
const SURFACES = [
  { file: '.claude-plugin/plugin.json', occurrences: 1 },
  { file: '.claude-plugin/marketplace.json', occurrences: 2 },
  { file: 'package.json', occurrences: 1 },
];
const SKELETON_SECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

const fail = (message) => {
  process.stderr.write(`release: ${message}\n`);
  process.exit(1);
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseSemver = (v) => {
  if (!/^\d+\.\d+\.\d+$/.test(v ?? '')) return null;
  return v.split('.').map(Number);
};

const semverGt = (a, b) => {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

function readJson(file) {
  if (!existsSync(file)) fail(`${file} not found — run from the repo root`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Slice the `## [<label>]` section body (heading excluded) out of the CHANGELOG. */
function sliceSection(src, label) {
  const marker = `## [${label}]`;
  const start = src.indexOf(marker);
  if (start === -1) return null;
  const afterHeading = src.indexOf('\n', start);
  const rest = src.slice(afterHeading);
  const next = rest.search(/\n## \[/);
  const endRel = next !== -1 ? next : (() => {
    const linkDefs = rest.search(/\n\[Unreleased\]:/);
    return linkDefs !== -1 ? linkDefs : rest.length;
  })();
  return { start, afterHeading, end: afterHeading + endRel, body: rest.slice(0, endRel) };
}

function cut(args) {
  const version = args.version;
  const target = parseSemver(version);
  if (!target) fail('--version must be in X.Y.Z form');
  // Local date — toISOString() is UTC, so an evening KST cut would stamp the previous day.
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const date = args.date ?? localDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('--date must be in YYYY-MM-DD form');

  const plugin = readJson(SURFACES[0].file);
  const prev = plugin.version;
  const current = parseSemver(prev);
  if (!current) fail(`plugin.json version (${prev}) is not semver`);
  if (!semverGt(target, current)) fail(`--version ${version} must be greater than the current ${prev}`);
  const repo = String(plugin.repository ?? '');
  if (!repo.startsWith('https://')) fail('plugin.json repository is not a URL — cannot build compare links');

  if (!existsSync(CHANGELOG)) fail(`${CHANGELOG} not found`);
  const src = readFileSync(CHANGELOG, 'utf8');

  const unreleased = sliceSection(src, 'Unreleased');
  if (!unreleased) fail('## [Unreleased] section not found');
  if (!/^- /m.test(unreleased.body)) fail('[Unreleased] is an empty skeleton — nothing to cut');

  // Validate link definitions before transforming the body — on inconsistent state, stop without writing anything.
  const unrelLink = new RegExp(`^\\[Unreleased\\]: (\\S+)/compare/v${escapeRegExp(prev)}\\.\\.\\.HEAD$`, 'm');
  const linkMatch = unrelLink.exec(src);
  if (!linkMatch) fail(`[Unreleased] link definition does not point to compare/v${prev}...HEAD — clean up manually first`);
  const base = linkMatch[1];

  // Pre-flight: read and validate all four surfaces in memory — **every rejection path must
  // write nothing** so the cut stays re-runnable (a leftover partial write blocks re-runs with
  // "version already bumped", leaving git checkout as the only way out).
  const surfaces = SURFACES.map(({ file, occurrences }) => {
    if (!existsSync(file)) fail(`${file} not found — run from the repo root`);
    const source = readFileSync(file, 'utf8');
    const needle = `"version": "${prev}"`;
    const count = source.split(needle).length - 1;
    if (count !== occurrences) {
      fail(`${file}: expected ${occurrences} occurrence(s) of "version": "${prev}" but found ${count} — inspect manually`);
    }
    return { file, source, needle };
  });

  const skeleton = `\n\n${SKELETON_SECTIONS.map((s) => `### ${s}`).join('\n\n')}\n\n`;
  let out =
    src.slice(0, unreleased.start) +
    `## [Unreleased]${skeleton}## [${version}] - ${date}` +
    unreleased.body +
    src.slice(unreleased.end);
  out = out.replace(
    unrelLink,
    () => `[Unreleased]: ${base}/compare/v${version}...HEAD\n[${version}]: ${base}/compare/v${prev}...v${version}`,
  );

  // The only write section starts here — reached only after every check above has passed.
  writeFileSync(CHANGELOG, out);
  for (const { file, source, needle } of surfaces) {
    // No JSON.stringify re-serialization — it would break human formatting such as inline arrays.
    writeFileSync(file, source.split(needle).join(`"version": "${version}"`));
  }
  const [pluginAfter, marketplaceAfter, packageAfter] = SURFACES.map(({ file }) => readJson(file));
  if (
    pluginAfter.version !== version ||
    marketplaceAfter.version !== version ||
    marketplaceAfter.plugins?.[0]?.version !== version ||
    packageAfter.version !== version
  ) {
    fail('post-replacement re-parse check failed — inspect the version surfaces manually');
  }

  // Advisory: if skill content changed, surface their independent semver bump (no auto-fix — that call belongs to a human).
  try {
    const changed = execFileSync('git', ['diff', '--name-only', `v${prev}..HEAD`, '--', 'skills/'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'], // keep missing-git/missing-tag stderr out of the success output
    }).trim();
    if (changed) {
      process.stderr.write(
        `release: (advisory) skills/ changed since v${prev} — consider bumping skills/*/SKILL.md metadata.version:\n${changed}\n`,
      );
    }
  } catch {
    /* silently skip where git or the tag is absent (e.g. test fixtures) */
  }

  process.stdout.write(
    [
      `release: v${version} cut complete — review and polish the diff, then run:`,
      '',
      `  git switch -c release/v${version}`,
      '  npm test',
      `  git commit -am "chore(release): v${version}"`,
      `  gh pr create --title "chore(release): v${version}" --body "Release cut — on merge, release-tag.yml attaches the tag and GitHub Release automatically."`,
      '',
      'Tagging after merge is automatic — manual git tag is forbidden (CONTRIBUTING).',
      '',
    ].join('\n'),
  );
}

function notes(args) {
  const version = args.version;
  if (!parseSemver(version)) fail('--version must be in X.Y.Z form');
  const src = readFileSync(CHANGELOG, 'utf8');
  const section = sliceSection(src, version);
  if (!section) fail(`## [${version}] section not found in ${CHANGELOG}`);
  const linkDef = new RegExp(`^\\[${escapeRegExp(version)}\\]: (\\S+)$`, 'm').exec(src);
  // Empty section headings with no entries (### Deprecated etc.) are stripped from the Release
  // body — the cut preserves the skeleton, but empty headings are noise in notes meant for humans.
  const body = section.body
    .trim()
    .split(/\n(?=### )/)
    .filter((block) => !block.startsWith('### ') || /^- /m.test(block))
    .map((block) => block.trim())
    .join('\n\n');
  if (!body) fail(`## [${version}] section is empty`);
  process.stdout.write(`${body}\n${linkDef ? `\n${linkDef[1]}\n` : ''}`);
}

function main() {
  // Keep early pipe termination (`notes ... | head`) from dying with a stack trace.
  process.stdout.on('error', (error) => {
    if (error.code === 'EPIPE') process.exit(0);
    throw error;
  });
  const [verb, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (verb === 'cut') return cut(args);
  if (verb === 'notes') return notes(args);
  return fail('usage: release.mjs <cut|notes> --version X.Y.Z [--date YYYY-MM-DD]');
}

main();
