/**
 * 문서 간 사실 정합성 검증.
 *
 * 이 레포는 마크다운이 곧 동작 정의라, 문서 드리프트가 곧 기능 결함이다.
 * CLAUDE.md의 "문서화 규율"(README EN/KO·CHANGELOG·PRINCIPLES 동시 갱신)을
 * 사람의 성실성에 맡기지 않고 기계가 강제하는 층.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  readRepoFile,
  repoPath,
  listMarkdownFiles,
  listCommandFiles,
  parseFrontmatter,
  stripCode,
  REPO_ROOT,
} from './helpers/repo.mjs';

const readmeEn = readRepoFile('README.md');
const readmeKo = readRepoFile('README.ko.md');
const changelog = readRepoFile('CHANGELOG.md');

const headings = (source) => source.split('\n').filter((line) => line.startsWith('## '));

describe('README EN/KO 패리티', () => {
  // 제목 텍스트는 번역이라 문자열로 대조할 수 없다. 개수 일치는 "한쪽에만 절이
  // 추가되는" 가장 흔한 드리프트를 잡는다. 실질 패리티는 아래 '커맨드 목록 정합'이 본다.
  it('두 언어 README의 섹션 개수가 같다', () => {
    assert.equal(headings(readmeEn).length, headings(readmeKo).length);
  });

  it('설치 문자열이 두 README에서 동일하다', () => {
    const installLine = (source) => source.match(/^\/plugin marketplace add .*$/m)?.[0];
    assert.ok(installLine(readmeEn), 'EN README에 marketplace add 줄이 없습니다');
    assert.equal(installLine(readmeEn), installLine(readmeKo));
  });

  it('설치 문자열이 공개 원격을 가리킨다 — 로컬 경로면 아무도 설치할 수 없다', () => {
    const line = readmeEn.match(/^\/plugin marketplace add (.*)$/m)?.[1];
    assert.ok(line, 'marketplace add 줄을 찾지 못했습니다');
    assert.doesNotMatch(line, /^[~./]/, `로컬 경로를 가리킵니다: ${line}`);
    assert.match(line, /^[\w.-]+\/[\w.-]+$/, `owner/repo 형식이어야 합니다: ${line}`);
  });

  it('정본 설치 커맨드가 두 README에 모두 있다', () => {
    // 리터럴 하드코딩이 아니라 manifest에서 조립한다 — plugin/marketplace name이
    // 바뀌면 README가 옛 문자열을 안내하는 드리프트를 이 검사가 즉시 드러낸다.
    const marketplace = JSON.parse(readRepoFile('.claude-plugin', 'marketplace.json'));
    const installLine = `/plugin install ${marketplace.plugins[0].name}@${marketplace.name}`;
    for (const [label, source] of [['EN', readmeEn], ['KO', readmeKo]]) {
      assert.ok(source.includes(installLine), `${label} README에 정본 install 문자열(${installLine})이 없습니다`);
    }
  });
});

describe('영문 산출물의 언어 순수성', () => {
  // 예외는 둘뿐이다: 언어 스위처와, 런타임 출력 계약(docs/EXECUTION-HANDOFF.md)이
  // 리터럴로 고정한 `(추천)` 라벨. 그 외 한국어가 남으면 영어 사용자에겐 해독 불가다.
  const ALLOWED = ['한국어', '(추천)'];
  // 완성형 한글만 보면 자모(ㅋㅋ)와 한자가 새어나간다.
  const CJK = /[가-힣ㄱ-ㅎㅏ-ㅣ㐀-鿿]/;
  const ENGLISH_DOCS = ['README.md', 'docs/PRINCIPLES.en.md', 'CLAUDE.md', 'CONTRIBUTING.md', 'NOTICE.md'];

  for (const file of ENGLISH_DOCS) {
    it(`${file}에 허용된 리터럴 외의 한국어·한자가 없다`, () => {
      const offenders = readRepoFile(file)
        .split('\n')
        .map((line, index) => {
          const stripped = ALLOWED.reduce((acc, literal) => acc.split(literal).join(''), line);
          return CJK.test(stripped) ? `L${index + 1}: ${line.trim()}` : null;
        })
        .filter(Boolean);

      assert.deepEqual(offenders, [], `${file}에 번역되지 않은 텍스트가 있습니다:\n${offenders.join('\n')}`);
    });
  }

  it('리터럴 (추천)에는 영어 설명이 붙어 있다', () => {
    for (const line of readmeEn.split('\n').filter((l) => l.includes('(추천)'))) {
      assert.match(line, /recommend/i, `영어 설명 없이 (추천)만 노출됩니다: ${line.trim()}`);
    }
  });
});

describe('CHANGELOG 링크 무결성', () => {
  const versionHeadings = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]);
  const linkDefinitions = new Set(
    [...changelog.matchAll(/^\[([^\]]+)\]:\s*\S+$/gm)].map((m) => m[1]),
  );

  it('릴리스 항목이 존재한다', () => {
    assert.ok(versionHeadings.length > 0);
  });

  const escape = (v) => v.replace(/\./g, '\\.');

  versionHeadings.forEach((version, index) => {
    it(`[${version}] 링크가 올바른 범위를 가리킨다`, () => {
      assert.ok(linkDefinitions.has(version), `[${version}]: 링크 정의가 없습니다 — GitHub에서 리터럴로 렌더된다`);

      const url = changelog.match(new RegExp(`^\\[${escape(version)}\\]:\\s*(\\S+)$`, 'm'))?.[1];
      assert.ok(url, `[${version}] 링크 URL을 읽지 못했습니다`);

      // 라벨만 있고 URL이 엉뚱한 범위를 가리키는 것이 릴리스에서 가장 흔한 드리프트다
      // (이전 버전 줄을 복붙하면서 한쪽만 고치는 경우).
      const previous = versionHeadings[index + 1];
      const expected = previous
        ? new RegExp(`compare/v${escape(previous)}\\.\\.\\.v${escape(version)}$`)
        : new RegExp(`releases/tag/v${escape(version)}$`);
      assert.match(url, expected);
    });
  });

  it('[Unreleased]가 최신 릴리스를 기준으로 비교한다', () => {
    const unreleased = changelog.match(/^\[Unreleased\]:\s*(\S+)$/m)?.[1];
    assert.ok(unreleased, '[Unreleased] 링크 정의가 없습니다');
    assert.match(
      unreleased,
      new RegExp(`compare/v${versionHeadings[0].replace(/\./g, '\\.')}\\.\\.\\.HEAD$`),
      `[Unreleased]가 최신 릴리스 v${versionHeadings[0]}이 아닌 옛 버전을 가리킵니다: ${unreleased}`,
    );
  });

  it('최신 릴리스 버전이 plugin.json과 일치한다', () => {
    const plugin = JSON.parse(readRepoFile('.claude-plugin', 'plugin.json'));
    assert.equal(versionHeadings[0], plugin.version);
  });
});

describe('CHANGELOG keep-a-changelog 골격', () => {
  // scripts/release.mjs cut의 골격 재생성 계약을 CI에서 봉인한다 — 이 검사가 없으면
  // 자동화나 편집이 빈 섹션을 지우거나 섹션 어휘를 바꿔도 어떤 테스트도 실패하지 않는다.
  const SECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

  // stripCode: 릴리스 노트 산문이 코드펜스로 `## [`·`### ` 예시를 인용해도 오탐하지 않게.
  const strippedChangelog = stripCode(changelog);

  it('[Unreleased]는 6섹션 전부를 정본 순서로 갖는다', () => {
    const start = strippedChangelog.indexOf('## [Unreleased]');
    assert.ok(start !== -1, '## [Unreleased] 절이 없습니다');
    const rest = strippedChangelog.slice(start);
    const next = rest.search(/\n## \[/);
    const section = next === -1 ? rest : rest.slice(0, next);
    const headings = [...section.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
    assert.deepEqual(headings, SECTIONS);
  });

  it('모든 절의 ### 헤딩이 keep-a-changelog 어휘·정본 순서를 지킨다 (릴리스 절은 부분집합 허용)', () => {
    const offenders = [];
    for (const chunk of strippedChangelog.split(/^## /m).slice(1)) {
      const label = chunk.slice(0, chunk.indexOf('\n'));
      let last = -1;
      for (const [, heading] of chunk.matchAll(/^### (.+)$/gm)) {
        const index = SECTIONS.indexOf(heading);
        if (index === -1) offenders.push(`${label}: 비표준 섹션 "${heading}"`);
        else if (index < last) offenders.push(`${label}: "${heading}" 순서 위반`);
        else last = index;
      }
    }
    assert.deepEqual(offenders, [], offenders.join('\n'));
  });
});

describe('내부 링크 무결성', () => {
  it('마크다운의 상대 링크가 모두 실재하는 파일을 가리킨다', () => {
    const broken = [];

    for (const file of listMarkdownFiles()) {
      const source = stripCode(readRepoFile(file));
      for (const match of source.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = match[1];
        // 외부 URL, 문서 내 앵커, 런타임 치환 변수는 정적으로 검증할 수 없다.
        if (/^(https?:|mailto:|#)/.test(target) || target.includes('${')) continue;

        const resolved = path.resolve(path.dirname(repoPath(file)), target.split('#')[0]);
        if (!existsSync(resolved)) broken.push(`${file} → ${target}`);
      }
    }

    assert.deepEqual(broken, [], `깨진 상대 링크:\n${broken.join('\n')}`);
  });

  it('마크다운 링크에 런타임 치환 변수를 넣지 않는다 — GitHub에서 404가 된다', () => {
    const offenders = [];

    for (const file of listMarkdownFiles()) {
      for (const match of stripCode(readRepoFile(file)).matchAll(/\[[^\]]*\]\(([^)\s]*\$\{[^)\s]*)\)/g)) {
        offenders.push(`${file} → ${match[1]}`);
      }
    }

    assert.deepEqual(offenders, [], `치환 변수를 URL에 넣은 링크:\n${offenders.join('\n')}`);
  });
});

describe('커맨드 목록 정합', () => {
  // 네이밍 2축(CLAUDE.md): FE 루프 커맨드는 `/omj-*`, 범용 워크플로우 커맨드는
  // 무접두 basename + 문서 표기는 항상 `/oh-my-joy:<name>` 정규 호출.
  const commandFiles = listCommandFiles();
  const feCommands = commandFiles
    .filter((f) => /^omj(-[a-z-]+)?\.md$/.test(f))
    .map((f) => `/${f.replace(/\.md$/, '')}`);
  const workflowCommands = commandFiles
    .filter((f) => !/^omj(-[a-z-]+)?\.md$/.test(f))
    .map((f) => f.replace(/\.md$/, ''));

  // README만 보면 docs/·commands/의 죽은 커맨드 참조를 놓친다. CHANGELOG는 이력 보존이라 제외,
  // 예고된 v1.1 커맨드(CLAUDE.md)와 개명 전 이력 표기는 명시 allowlist로 허용한다.
  const PLANNED_COMMANDS = new Set(['/omj-push', '/omj-spec']);
  const HISTORICAL_COMMANDS = new Set(['/omj-review']);

  // 표 행이 커맨드 토큰만 싣고 인자를 빠뜨리는 드리프트(감사에서 --threshold 미문서화로
  // 실증)를 막는다 — argument-hint의 플래그는 사용자가 알아야 호출할 수 있는 표면이다.
  // --help는 관례 플래그라 제외. 매칭은 경계 정규식 — --slug가 --slugify로 충족되지 않게.
  it('전 커맨드의 argument-hint 플래그가 README(EN/KO) 양쪽에 문서화돼 있다', () => {
    const offenders = [];
    for (const file of commandFiles) {
      const fm = parseFrontmatter(readRepoFile('commands', file));
      const flags = [...(fm['argument-hint'] ?? '').matchAll(/--[A-Za-z][\w-]*/g)]
        .map((m) => m[0])
        .filter((flag) => flag !== '--help');
      for (const flag of flags) {
        const bounded = new RegExp(`${flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
        for (const [label, source] of [['EN', readmeEn], ['KO', readmeKo]]) {
          if (!bounded.test(source)) offenders.push(`${label}: ${file}의 ${flag}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `플래그 문서 누락:\n${offenders.join('\n')}`);
  });

  it('추적되는 전 마크다운이 실재하는 커맨드만 문서화한다', () => {
    const offenders = [];
    for (const file of listMarkdownFiles().filter((f) => f !== 'CHANGELOG.md')) {
      const source = readRepoFile(file);
      for (const [, command] of source.matchAll(/`(\/omj(?:-[a-z-]+)?)`/g)) {
        if (feCommands.includes(command) || PLANNED_COMMANDS.has(command) || HISTORICAL_COMMANDS.has(command)) continue;
        offenders.push(`${file}: ${command}`);
      }
      for (const [, name] of source.matchAll(/`\/oh-my-joy:([a-z-]+)`/g)) {
        if (!workflowCommands.includes(name)) offenders.push(`${file}: /oh-my-joy:${name}`);
      }
    }
    assert.deepEqual(offenders, [], `실재하지 않는 커맨드를 문서화합니다:\n${offenders.join('\n')}`);
  });

  it('모든 커맨드가 README(EN/KO)에 문서화돼 있다', () => {
    for (const [label, source] of [['EN', readmeEn], ['KO', readmeKo]]) {
      for (const command of feCommands) {
        assert.ok(source.includes(`\`${command}\``), `${label} README에 ${command} 문서가 없습니다`);
      }
      for (const name of workflowCommands) {
        assert.ok(
          source.includes(`\`/oh-my-joy:${name}\``),
          `${label} README에 /oh-my-joy:${name} 문서가 없습니다`,
        );
      }
    }
  });

  it('워크플로우 커맨드를 bare 슬래시로 표기하지 않는다 — 정규 호출만', () => {
    // bare `/deep-interview` 류는 OMC 동명 스킬·Claude Code 네이티브 커맨드와 어느
    // 구현이 뜨는지 모호하다. 추적되는 전 마크다운 표면에서 차단한다 —
    // CHANGELOG만 예외(과거 릴리스 항목은 개명 전 표기를 이력으로 보존한다).
    const sources = [
      ['README.md', readmeEn],
      ['README.ko.md', readmeKo],
      ...listMarkdownFiles()
        .filter((f) => f !== 'CHANGELOG.md' && !f.startsWith('README'))
        .map((f) => [f, readRepoFile(f)]),
    ];
    const offenders = [];
    for (const name of workflowCommands) {
      // 정확 매칭(`/name`)만 보면 인자 동반 인라인 코드(`/name --flag`)와 펜스 코드블록
      // 안의 bare 표기를 놓친다. 앞 경계에서 `:`(정규 호출 oh-my-joy:name)·`/`·단어
      // 문자(경로 조각 commands/name.md)·`.`(상대링크 ./name.md)·`~`·`}`(치환변수
      // ${…}/name)를 제외하고, 뒤에 `.md`가 붙으면 경로로 간주해 제외한다.
      // 알려진 잔존 오탐: 한국어 문자 바로 뒤의 `/name`(\w가 한글을 포함하지 않음).
      const bare = new RegExp(`(^|[^\\w:/.~}])/${name}(?![\\w-]|\\.md)`, 'm');
      for (const [label, source] of sources) {
        if (bare.test(source)) offenders.push(`${label}: /${name}`);
      }
    }
    assert.deepEqual(offenders, [], `bare 표기는 /oh-my-joy:<name>으로 바꿔야 합니다:\n${offenders.join('\n')}`);
  });
});

describe('CLAUDE.md 유지보수 규율', () => {
  it('선언한 상한(120줄)을 지킨다', () => {
    const lines = readRepoFile('CLAUDE.md').split('\n').length;
    assert.ok(lines < 120, `CLAUDE.md가 ${lines}줄입니다 — 스스로 선언한 상한을 넘었습니다`);
  });

  it('레포 루트 기준 경로가 실재한다', () => {
    const missing = [...readRepoFile('CLAUDE.md').matchAll(/`(docs\/[\w.-]+\.md)`/g)]
      .map((m) => m[1])
      .filter((target) => !existsSync(path.join(REPO_ROOT, target)));

    assert.deepEqual(missing, [], `CLAUDE.md가 없는 문서를 가리킵니다: ${missing.join(', ')}`);
  });
});
