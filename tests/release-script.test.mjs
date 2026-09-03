/**
 * Behavioral proof for release.mjs — verified through a
 * real child process (argv/exit code/stdout·stderr) rather than function imports.
 *
 * The script's contract is threefold:
 *   ① finalizing [Unreleased] is a deterministic structural transform — no prose is created or summarized
 *   ② the 4-surface version replacement rejects without writing anything when occurrence counts mismatch
 *   ③ a CHANGELOG in inconsistent state (link-definition drift, empty skeleton) rejects the cut itself
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { repoPath } from './helpers/repo.mjs';

const SCRIPT = repoPath('scripts', 'release.mjs');

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const FIXTURE_CHANGELOG = `# Changelog

## [Unreleased]

### Added

- One new feature.

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.1.0] - 2026-01-01

### Added

- Initial release.

[Unreleased]: https://github.com/x/y/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/x/y/releases/tag/v0.1.0
`;

function makeFixture({ changelog = FIXTURE_CHANGELOG, version = '0.1.0' } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'omj-release-'));
  roots.push(root);
  mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  writeFileSync(path.join(root, 'CHANGELOG.md'), changelog);
  writeFileSync(
    path.join(root, '.claude-plugin/plugin.json'),
    `${JSON.stringify({ name: 't', version, repository: 'https://github.com/x/y' }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(root, '.claude-plugin/marketplace.json'),
    `${JSON.stringify({ name: 'm', version, plugins: [{ name: 't', version }] }, null, 2)}\n`,
  );
  writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({ name: 't', version, private: true }, null, 2)}\n`);
  return root;
}

function run(cwd, args) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status, stderr: String(error.stderr) };
  }
}

describe('release cut — normal transform', () => {
  const root = makeFixture();
  const result = run(root, ['cut', '--version', '0.2.0', '--date', '2026-02-02']);

  it('succeeds and prints the follow-up commands', () => {
    assert.equal(result.code, 0);
    assert.match(result.stdout, /release\/v0\.2\.0/);
    assert.match(result.stdout, /chore\(release\): v0\.2\.0/);
  });

  const changelog = () => readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

  it('moves the [Unreleased] body into the new version section verbatim (no prose changes)', () => {
    const src = changelog();
    assert.match(src, /## \[0\.2\.0\] - 2026-02-02\n\n### Added\n\n- One new feature\./);
    assert.match(src, /## \[0\.1\.0\] - 2026-01-01/);
  });

  it('regenerates the empty 6-section skeleton under [Unreleased] in canonical order', () => {
    const unreleased = changelog().split('## [0.2.0]')[0];
    const headings = [...unreleased.matchAll(/^### (\w+)$/gm)].map((m) => m[1]);
    assert.deepEqual(headings, ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']);
    assert.ok(!/^- /m.test(unreleased), 'entries remain in the regenerated skeleton');
  });

  it('updates and inserts the link definitions', () => {
    const src = changelog();
    assert.match(src, /^\[Unreleased\]: https:\/\/github\.com\/x\/y\/compare\/v0\.2\.0\.\.\.HEAD$/m);
    assert.match(src, /^\[0\.2\.0\]: https:\/\/github\.com\/x\/y\/compare\/v0\.1\.0\.\.\.v0\.2\.0$/m);
  });

  it('bumps all four version surfaces', () => {
    const plugin = JSON.parse(readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
    const marketplace = JSON.parse(readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf8'));
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(plugin.version, '0.2.0');
    assert.equal(marketplace.version, '0.2.0');
    assert.equal(marketplace.plugins[0].version, '0.2.0');
    assert.equal(pkg.version, '0.2.0');
  });
});

describe('release cut — rejection guards', () => {
  it('rejects non-semver and non-increasing versions', () => {
    const root = makeFixture();
    assert.equal(run(root, ['cut', '--version', 'v0.2.0']).code, 1);
    const notGreater = run(root, ['cut', '--version', '0.1.0']);
    assert.equal(notGreater.code, 1);
    assert.match(notGreater.stderr, /must be greater/);
  });

  it('rejects a cut when [Unreleased] is empty', () => {
    const empty = FIXTURE_CHANGELOG.replace('- One new feature.\n', '');
    const root = makeFixture({ changelog: empty });
    const result = run(root, ['cut', '--version', '0.2.0']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /empty skeleton/);
  });

  it('rejects cleanly and writes no files when a version surface file is missing', () => {
    const root = makeFixture();
    rmSync(path.join(root, 'package.json'));
    const result = run(root, ['cut', '--version', '0.2.0']);
    assert.equal(result.code, 1);
    // Must be the fail() path, not a crash (stack trace) — exit code 1 overlaps with unhandled exceptions.
    assert.match(result.stderr, /not found/);
    assert.doesNotMatch(result.stderr, /at cut/);
    assert.equal(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), FIXTURE_CHANGELOG, 'CHANGELOG was written on a rejection path');
    const plugin = JSON.parse(readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
    assert.equal(plugin.version, '0.1.0', 'a surface was modified on a rejection path');
  });

  it('rejects without writing any file when a surface occurrence count mismatches', () => {
    const root = makeFixture();
    const marketplaceFile = path.join(root, '.claude-plugin/marketplace.json');
    // Create 3 occurrences of "version": "0.1.0" to trip the count guard.
    writeFileSync(
      marketplaceFile,
      `${JSON.stringify({ name: 'm', version: '0.1.0', plugins: [{ name: 't', version: '0.1.0' }, { name: 'u', version: '0.1.0' }] }, null, 2)}\n`,
    );
    const result = run(root, ['cut', '--version', '0.2.0']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /expected 2 occurrence\(s\).*but found 3/);
    assert.equal(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), FIXTURE_CHANGELOG, 'CHANGELOG was written on a rejection path');
    const plugin = JSON.parse(readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
    assert.equal(plugin.version, '0.1.0', 'a surface was modified on a rejection path');
  });

  it('rejects without writing anything when the [Unreleased] link definition drifts from the current version', () => {
    const drifted = FIXTURE_CHANGELOG.replace('compare/v0.1.0...HEAD', 'compare/v0.0.9...HEAD');
    const root = makeFixture({ changelog: drifted });
    const result = run(root, ['cut', '--version', '0.2.0']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /link definition/);
    const plugin = JSON.parse(readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
    assert.equal(plugin.version, '0.1.0', 'a surface was modified on a rejection path');
  });
});

describe('release notes — section extraction', () => {
  it('extracts the version section body and its link', () => {
    const root = makeFixture();
    const result = run(root, ['notes', '--version', '0.1.0']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /- Initial release\./);
    assert.match(result.stdout, /releases\/tag\/v0\.1\.0/);
  });

  it('strips empty section headings of a just-cut section from the notes', () => {
    const root = makeFixture();
    assert.equal(run(root, ['cut', '--version', '0.2.0', '--date', '2026-02-02']).code, 0);
    const result = run(root, ['notes', '--version', '0.2.0']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /### Added/);
    assert.match(result.stdout, /- One new feature\./);
    assert.doesNotMatch(result.stdout, /### Deprecated/, 'an entry-less section heading leaked into the Release body');
  });

  it('rejects a missing version with a non-zero exit', () => {
    const root = makeFixture();
    const result = run(root, ['notes', '--version', '9.9.9']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /not found/);
  });

  it('real-repo consistency — the section for the current plugin.json version extracts', () => {
    const plugin = JSON.parse(readFileSync(repoPath('.claude-plugin', 'plugin.json'), 'utf8'));
    const result = run(repoPath(), ['notes', '--version', plugin.version]);
    assert.equal(result.code, 0);
    assert.ok(result.stdout.trim().length > 0, 'the current version section in the real CHANGELOG is empty');
  });
});

describe('release next — version inference', () => {
  it('bumps the patch when [Unreleased] carries only additions or fixes', () => {
    const root = makeFixture();
    const result = run(root, ['next']);
    assert.equal(result.code, 0);
    assert.equal(result.stdout.trim(), '0.1.1');
  });

  it('bumps the minor when anything was removed, changed, or deprecated', () => {
    const withRemoval = FIXTURE_CHANGELOG.replace('### Removed\n', '### Removed\n\n- Dropped the legacy flag.\n');
    const root = makeFixture({ changelog: withRemoval });
    const result = run(root, ['next']);
    assert.equal(result.code, 0);
    assert.equal(result.stdout.trim(), '0.2.0');
  });

  it('never infers a major bump — it is taken only from --bump', () => {
    const root = makeFixture();
    assert.equal(run(root, ['next', '--bump', 'major']).stdout.trim(), '1.0.0');
    assert.equal(run(root, ['next', '--bump', 'minor']).stdout.trim(), '0.2.0');
    const bad = run(root, ['next', '--bump', 'huge']);
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /--bump must be/);
  });

  it('refuses when [Unreleased] is an empty skeleton', () => {
    const empty = FIXTURE_CHANGELOG.replace('- One new feature.\n', '');
    const root = makeFixture({ changelog: empty });
    const result = run(root, ['next']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /nothing to release/);
  });
});
