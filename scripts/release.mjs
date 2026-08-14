#!/usr/bin/env node
/**
 * release — 릴리스 컷의 결정적 파일 변환기 (git 무접촉).
 *
 * 배포 모델 전제(CONTRIBUTING "릴리스" 절): 마켓플레이스는 main HEAD를 배포하지만
 * plugin.json `version`이 배포 게이트라, 버전 범프가 머지되는 순간이 곧 배포다.
 * 이 스크립트는 그 범프를 사람이 4표면에 손으로 반복하다 어긋나는 사고(테스트가
 * 잡긴 하지만 매번 왕복 비용)와, CHANGELOG 절 확정·링크 2줄의 기계적 실수를 없앤다.
 *
 * 소유 경계: CHANGELOG **본문 산문은 사람이 쓴다** — 이 스크립트는 [Unreleased]를
 * 버전 절로 옮기고 빈 골격을 재생성하는 구조 변환만 한다(항목 생성·요약 금지).
 * git 명령을 실행하지 않으므로(스킬 advisory의 read-only diff 제외) 컷 결과는
 * 항상 사람이 diff로 검토한 뒤 커밋한다. 태깅은 release-tag.yml 워크플로우 소관.
 *
 *   cut   --version X.Y.Z [--date YYYY-MM-DD]  # [Unreleased] 확정 + 4표면 범프
 *   notes --version X.Y.Z                      # 해당 절 본문 추출(GitHub Release 본문)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const CHANGELOG = 'CHANGELOG.md';
/** 버전 4표면 — tests/plugin-manifest.test.mjs가 일치를 강제하는 그 목록과 동일. */
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
  if (!existsSync(file)) fail(`${file}이 없습니다 — 레포 루트에서 실행해야 합니다`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** CHANGELOG에서 `## [<label>]` 절 본문을 (heading 제외) 잘라낸다. */
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
  if (!target) fail('--version X.Y.Z 형식이 필요합니다');
  // 로컬 날짜 — toISOString()은 UTC라 KST 저녁 컷에 전날이 찍힌다.
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const date = args.date ?? localDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('--date는 YYYY-MM-DD 형식이어야 합니다');

  const plugin = readJson(SURFACES[0].file);
  const prev = plugin.version;
  const current = parseSemver(prev);
  if (!current) fail(`plugin.json version(${prev})이 semver가 아닙니다`);
  if (!semverGt(target, current)) fail(`--version ${version}은 현재 ${prev}보다 커야 합니다`);
  const repo = String(plugin.repository ?? '');
  if (!repo.startsWith('https://')) fail('plugin.json repository가 URL이 아닙니다 — compare 링크를 만들 수 없습니다');

  if (!existsSync(CHANGELOG)) fail(`${CHANGELOG}이 없습니다`);
  const src = readFileSync(CHANGELOG, 'utf8');

  const unreleased = sliceSection(src, 'Unreleased');
  if (!unreleased) fail('## [Unreleased] 절이 없습니다');
  if (!/^- /m.test(unreleased.body)) fail('[Unreleased]가 빈 골격뿐입니다 — 컷할 변경이 없습니다');

  // 링크 정의는 본문 변환 전에 검증한다 — 상태가 어긋나 있으면 아무것도 쓰지 않고 멈춘다.
  const unrelLink = new RegExp(`^\\[Unreleased\\]: (\\S+)/compare/v${escapeRegExp(prev)}\\.\\.\\.HEAD$`, 'm');
  const linkMatch = unrelLink.exec(src);
  if (!linkMatch) fail(`[Unreleased] 링크 정의가 compare/v${prev}...HEAD를 가리키지 않습니다 — 수동 정리 필요`);
  const base = linkMatch[1];

  // pre-flight: 4표면을 전부 메모리에서 읽고 검증한다 — **모든 거부 경로는 무쓰기**여야
  // 재실행 가능하다(부분 쓰기가 남으면 "버전이 이미 올랐다"로 재실행이 막혀 git checkout이 유일한 출구가 된다).
  const surfaces = SURFACES.map(({ file, occurrences }) => {
    if (!existsSync(file)) fail(`${file}이 없습니다 — 레포 루트에서 실행해야 합니다`);
    const source = readFileSync(file, 'utf8');
    const needle = `"version": "${prev}"`;
    const count = source.split(needle).length - 1;
    if (count !== occurrences) {
      fail(`${file}: "version": "${prev}" ${occurrences}곳을 기대했으나 ${count}곳 — 수동 확인 필요`);
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

  // 여기서부터가 유일한 쓰기 구간 — 위 검증을 전부 통과한 뒤에만 도달한다.
  writeFileSync(CHANGELOG, out);
  for (const { file, source, needle } of surfaces) {
    // JSON.stringify 재직렬화는 쓰지 않는다 — 인라인 배열 등 사람 포맷이 깨진다.
    writeFileSync(file, source.split(needle).join(`"version": "${version}"`));
  }
  const [pluginAfter, marketplaceAfter, packageAfter] = SURFACES.map(({ file }) => readJson(file));
  if (
    pluginAfter.version !== version ||
    marketplaceAfter.version !== version ||
    marketplaceAfter.plugins?.[0]?.version !== version ||
    packageAfter.version !== version
  ) {
    fail('치환 후 재파싱 검증 실패 — 버전 표면을 수동 확인하세요');
  }

  // advisory: 스킬 내용 변경이 있으면 독립 semver 상향을 상기시킨다(자동 수정 안 함 — 판단은 사람 몫).
  try {
    const changed = execFileSync('git', ['diff', '--name-only', `v${prev}..HEAD`, '--', 'skills/'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'], // git 부재·태그 부재의 stderr가 성공 출력에 새지 않게
    }).trim();
    if (changed) {
      process.stderr.write(
        `release: (advisory) v${prev} 이후 skills/ 변경 감지 — skills/*/SKILL.md metadata.version 상향을 검토하세요:\n${changed}\n`,
      );
    }
  } catch {
    /* git·태그 부재 환경(예: 테스트 fixture)에서는 조용히 스킵 */
  }

  process.stdout.write(
    [
      `release: v${version} 컷 완료 — diff를 검토·다듬은 뒤 아래를 실행하세요.`,
      '',
      `  git switch -c release/v${version}`,
      '  npm test',
      `  git commit -am "chore(release): v${version}"`,
      `  gh pr create --title "chore(release): v${version}" --body "릴리스 컷 — 머지되면 release-tag.yml이 태그·GitHub Release를 자동 부착합니다."`,
      '',
      '머지 후 태깅은 자동입니다 — 수동 git tag는 금지(CONTRIBUTING).',
      '',
    ].join('\n'),
  );
}

function notes(args) {
  const version = args.version;
  if (!parseSemver(version)) fail('--version X.Y.Z 형식이 필요합니다');
  const src = readFileSync(CHANGELOG, 'utf8');
  const section = sliceSection(src, version);
  if (!section) fail(`## [${version}] 절이 ${CHANGELOG}에 없습니다`);
  const linkDef = new RegExp(`^\\[${escapeRegExp(version)}\\]: (\\S+)$`, 'm').exec(src);
  // 항목 없는 빈 섹션 헤딩(### Deprecated 등)은 Release 본문에서 걷어낸다 —
  // 컷이 골격을 보존하는 것과 별개로, 사람이 읽는 노트에 빈 헤딩은 소음이다.
  const body = section.body
    .trim()
    .split(/\n(?=### )/)
    .filter((block) => !block.startsWith('### ') || /^- /m.test(block))
    .map((block) => block.trim())
    .join('\n\n');
  if (!body) fail(`## [${version}] 절이 비어 있습니다`);
  process.stdout.write(`${body}\n${linkDef ? `\n${linkDef[1]}\n` : ''}`);
}

function main() {
  // `notes ... | head` 같은 파이프 조기 종료가 스택 트레이스로 죽지 않게 한다.
  process.stdout.on('error', (error) => {
    if (error.code === 'EPIPE') process.exit(0);
    throw error;
  });
  const [verb, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (verb === 'cut') return cut(args);
  if (verb === 'notes') return notes(args);
  return fail('사용법: release.mjs <cut|notes> --version X.Y.Z [--date YYYY-MM-DD]');
}

main();
