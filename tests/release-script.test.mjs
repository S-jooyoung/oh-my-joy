/**
 * release.mjs 동작 증명 — goal-state.test.mjs와 같은 이유로 함수 import가 아니라
 * 실제 자식 프로세스(argv/exit code/stdout·stderr)로 검증한다.
 *
 * 이 스크립트의 계약은 셋이다:
 *   ① [Unreleased] 확정은 결정적 구조 변환이다 — 산문을 만들거나 요약하지 않는다
 *   ② 버전 4표면 치환은 기대 발생 횟수와 어긋나면 아무것도 쓰지 않고 거부한다
 *   ③ 상태가 어긋난 CHANGELOG(링크 정의 불일치·빈 골격)는 컷 자체를 거부한다
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

- 새 기능 하나.

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.1.0] - 2026-01-01

### Added

- 최초 릴리스.

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

describe('release cut — 정상 변환', () => {
  const root = makeFixture();
  const result = run(root, ['cut', '--version', '0.2.0', '--date', '2026-02-02']);

  it('성공하고 후속 명령을 안내한다', () => {
    assert.equal(result.code, 0);
    assert.match(result.stdout, /release\/v0\.2\.0/);
    assert.match(result.stdout, /chore\(release\): v0\.2\.0/);
  });

  const changelog = () => readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

  it('[Unreleased] 본문이 새 버전 절로 그대로 이동한다 (산문 무변형)', () => {
    const src = changelog();
    assert.match(src, /## \[0\.2\.0\] - 2026-02-02\n\n### Added\n\n- 새 기능 하나\./);
    assert.match(src, /## \[0\.1\.0\] - 2026-01-01/);
  });

  it('[Unreleased]에 6섹션 빈 골격이 정본 순서로 재생성된다', () => {
    const unreleased = changelog().split('## [0.2.0]')[0];
    const headings = [...unreleased.matchAll(/^### (\w+)$/gm)].map((m) => m[1]);
    assert.deepEqual(headings, ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']);
    assert.ok(!/^- /m.test(unreleased), '재생성된 골격에 항목이 남아 있습니다');
  });

  it('링크 정의가 갱신·삽입된다', () => {
    const src = changelog();
    assert.match(src, /^\[Unreleased\]: https:\/\/github\.com\/x\/y\/compare\/v0\.2\.0\.\.\.HEAD$/m);
    assert.match(src, /^\[0\.2\.0\]: https:\/\/github\.com\/x\/y\/compare\/v0\.1\.0\.\.\.v0\.2\.0$/m);
  });

  it('버전 4표면이 전부 범프된다', () => {
    const plugin = JSON.parse(readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
    const marketplace = JSON.parse(readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf8'));
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(plugin.version, '0.2.0');
    assert.equal(marketplace.version, '0.2.0');
    assert.equal(marketplace.plugins[0].version, '0.2.0');
    assert.equal(pkg.version, '0.2.0');
  });
});

describe('release cut — 거부 가드', () => {
  it('semver 아닌 버전·비증가 버전을 거부한다', () => {
    const root = makeFixture();
    assert.equal(run(root, ['cut', '--version', 'v0.2.0']).code, 1);
    const notGreater = run(root, ['cut', '--version', '0.1.0']);
    assert.equal(notGreater.code, 1);
    assert.match(notGreater.stderr, /커야 합니다/);
  });

  it('빈 [Unreleased]는 컷을 거부한다', () => {
    const empty = FIXTURE_CHANGELOG.replace('- 새 기능 하나.\n', '');
    const root = makeFixture({ changelog: empty });
    const result = run(root, ['cut', '--version', '0.2.0']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /빈 골격/);
  });

  it('버전 표면 파일이 없으면 정상 거부하고 아무 파일도 쓰지 않는다', () => {
    const root = makeFixture();
    rmSync(path.join(root, 'package.json'));
    const result = run(root, ['cut', '--version', '0.2.0']);
    assert.equal(result.code, 1);
    // 크래시(스택 트레이스)가 아니라 fail() 경로여야 한다 — 종료 코드 1은 미처리 예외와 겹친다.
    assert.match(result.stderr, /없습니다/);
    assert.doesNotMatch(result.stderr, /at cut/);
    assert.equal(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), FIXTURE_CHANGELOG, '거부 경로에서 CHANGELOG가 쓰였습니다');
    const plugin = JSON.parse(readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
    assert.equal(plugin.version, '0.1.0', '거부 경로에서 표면이 변경됐습니다');
  });

  it('표면의 버전 발생 횟수가 기대와 어긋나면 아무 파일도 쓰지 않고 거부한다', () => {
    const root = makeFixture();
    const marketplaceFile = path.join(root, '.claude-plugin/marketplace.json');
    // "version": "0.1.0"이 3곳이 되게 만들어 count 가드를 발화시킨다.
    writeFileSync(
      marketplaceFile,
      `${JSON.stringify({ name: 'm', version: '0.1.0', plugins: [{ name: 't', version: '0.1.0' }, { name: 'u', version: '0.1.0' }] }, null, 2)}\n`,
    );
    const result = run(root, ['cut', '--version', '0.2.0']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /2곳을 기대했으나 3곳/);
    assert.equal(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), FIXTURE_CHANGELOG, '거부 경로에서 CHANGELOG가 쓰였습니다');
    const plugin = JSON.parse(readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
    assert.equal(plugin.version, '0.1.0', '거부 경로에서 표면이 변경됐습니다');
  });

  it('[Unreleased] 링크 정의가 현재 버전과 어긋나면 아무것도 쓰지 않고 거부한다', () => {
    const drifted = FIXTURE_CHANGELOG.replace('compare/v0.1.0...HEAD', 'compare/v0.0.9...HEAD');
    const root = makeFixture({ changelog: drifted });
    const result = run(root, ['cut', '--version', '0.2.0']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /링크 정의/);
    const plugin = JSON.parse(readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
    assert.equal(plugin.version, '0.1.0', '거부 경로에서 표면이 변경됐습니다');
  });
});

describe('release notes — 절 추출', () => {
  it('버전 절 본문과 링크를 추출한다', () => {
    const root = makeFixture();
    const result = run(root, ['notes', '--version', '0.1.0']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /- 최초 릴리스\./);
    assert.match(result.stdout, /releases\/tag\/v0\.1\.0/);
  });

  it('컷 직후 절의 빈 섹션 헤딩은 노트에서 걷어낸다', () => {
    const root = makeFixture();
    assert.equal(run(root, ['cut', '--version', '0.2.0', '--date', '2026-02-02']).code, 0);
    const result = run(root, ['notes', '--version', '0.2.0']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /### Added/);
    assert.match(result.stdout, /- 새 기능 하나\./);
    assert.doesNotMatch(result.stdout, /### Deprecated/, '항목 없는 섹션 헤딩이 Release 본문에 샙니다');
  });

  it('없는 버전은 non-zero로 거부한다', () => {
    const root = makeFixture();
    const result = run(root, ['notes', '--version', '9.9.9']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /없습니다/);
  });

  it('실레포 정합 — 현재 plugin.json 버전의 절이 추출된다', () => {
    const plugin = JSON.parse(readFileSync(repoPath('.claude-plugin', 'plugin.json'), 'utf8'));
    const result = run(repoPath(), ['notes', '--version', plugin.version]);
    assert.equal(result.code, 0);
    assert.ok(result.stdout.trim().length > 0, '실레포 CHANGELOG에서 현재 버전 절이 비어 있습니다');
  });
});
