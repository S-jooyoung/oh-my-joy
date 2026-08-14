/**
 * 플러그인 매니페스트·커맨드·에이전트·스킬의 구조 검증.
 *
 * 이 레포는 "동작이 마크다운 frontmatter로 선언되는" 플러그인이라, 오타 하나가
 * 런타임에서야 권한 실패로 드러난다. 여기서 검증하는 것은 전부 정적으로 확인 가능한
 * 사실들 — 스키마 필드, 버전 일치, 파일명↔선언 일치, 그리고 이 레포의 최우선 불변식인
 * "플러그인은 hooks.json을 두지 않는다"이다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import {
  readJson,
  readRepoFile,
  repoPath,
  listCommandFiles,
  listAgentFiles,
  parseFrontmatter,
} from './helpers/repo.mjs';

const plugin = readJson('.claude-plugin', 'plugin.json');
const marketplace = readJson('.claude-plugin', 'marketplace.json');

/**
 * 소스 코드에 부작용을 낼 수 없다고 문서가 선언한 커맨드들 — 권한 등급 2단.
 *
 * ZERO_BASH: 셸 실행 경로가 아예 없다(쓰기 도구·Task/Agent에 더해 Bash 토큰 0).
 *   `/omj`는 plan-gate를 우회할 쓰기 경로가 없어야 하고(PRINCIPLES ①③),
 *   `deep-interview`·`ralplan`은 네이티브 Plan만 산출하는 프라이머·리뷰 커맨드다.
 * REPORT_ONLY: 소스는 절대 수정하지 않지만 관찰용 스코프 Bash는 쓴다 —
 *   `ff-review`(git diff 판독)·`omj-verify`(브라우저 기동·캡처).
 *   bare Bash는 전 커맨드 공통 검사가 이미 차단하므로 여기선 쓰기 도구만 본다.
 */
const ZERO_BASH_COMMANDS = new Set(['omj.md', 'deep-interview.md', 'ralplan.md']);
const REPORT_ONLY_COMMANDS = new Set(['ff-review.md', 'omj-verify.md']);
const READ_ONLY_COMMANDS = new Set([...ZERO_BASH_COMMANDS, ...REPORT_ONLY_COMMANDS]);

/**
 * 무접두 네이밍이 허용된 "이름 있는 방법론·루브릭" 커맨드(2축 규칙 — CLAUDE.md).
 * FE 루프 동사는 `/omj-*` 정규식이, 이 축은 화이트리스트가 담당한다.
 * 이 목록은 새 커맨드를 추가하는 PR에서 함께 편집되므로 하드 차단이 아니라
 * 속도 방지턱이다 — 우발적 무접두 파일 추가를 리뷰 가시권으로 끌어낸다.
 */
const WORKFLOW_COMMANDS = new Set(['deep-interview.md', 'ff-review.md', 'goal-loop.md', 'ralplan.md']);

describe('plugin.json', () => {
  it('필수 필드를 갖는다', () => {
    for (const field of ['name', 'version', 'description', 'author', 'license']) {
      assert.ok(plugin[field], `plugin.json에 ${field}가 없습니다`);
    }
  });

  it('버전이 semver다', () => {
    assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  });

  it('$schema가 실재하는 SchemaStore 등재본을 가리킨다', () => {
    // 존재 검사만으로는 죽은 URL이 통과해 "에디터 검증" 효과가 공허해진다 —
    // 종전 anthropic.com URL은 404였다. 정본 URL 리터럴을 고정해 드리프트를 드러낸다.
    assert.equal(plugin.$schema, 'https://json.schemastore.org/claude-code-plugin-manifest.json');
    assert.equal(marketplace.$schema, 'https://json.schemastore.org/claude-code-marketplace.json');
  });

  it('선언한 라이선스가 LICENSE 파일과 일치한다', () => {
    assert.equal(plugin.license, 'MIT');
    assert.match(readRepoFile('LICENSE'), /MIT License/);
  });
});

describe('marketplace.json', () => {
  it('필수 필드를 갖는다', () => {
    assert.ok(marketplace.name);
    assert.ok(marketplace.owner?.name);
    assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length > 0);
  });

  it('등재된 플러그인이 실재하는 source를 가리킨다', () => {
    for (const entry of marketplace.plugins) {
      assert.ok(entry.name, 'plugins[].name 누락');
      assert.ok(entry.source, 'plugins[].source 누락');
      assert.ok(existsSync(repoPath(entry.source)), `source 경로가 없습니다: ${entry.source}`);
    }
  });

  it('버전 표면 전체가 plugin.json과 일치한다 — 드리프트가 조용히 남지 않게', () => {
    const entry = marketplace.plugins.find((p) => p.name === plugin.name);
    assert.ok(entry, `marketplace.json에 ${plugin.name} 항목이 없습니다`);

    // 버전은 네 곳에 산다. 하나만 검사하면 나머지 셋이 조용히 어긋난다.
    const surfaces = [
      ['marketplace.plugins[].version', entry.version],
      ['marketplace 최상위 version', marketplace.version],
      ['package.json version', readJson('package.json').version],
    ];
    for (const [label, actual] of surfaces) {
      assert.equal(actual, plugin.version, `${label}이 plugin.json(${plugin.version})과 다릅니다`);
    }
  });
});

describe('플러그인 구조 불변식', () => {
  // CLAUDE.md의 최우선 규칙이자 PRINCIPLES ⑩의 명시적 기각 대안.
  // hooks.json이 존재하면 플러그인 enable만으로 모든 소비 레포에서 훅이 자동 발화한다.
  it('플러그인은 hooks.json을 두지 않는다 (zero-hook)', () => {
    for (const candidate of ['hooks/hooks.json', '.claude-plugin/hooks.json', 'hooks.json']) {
      assert.ok(!existsSync(repoPath(candidate)), `${candidate}가 존재하면 전 레포 자동 발화가 일어납니다`);
    }
  });

  it('훅 스크립트 정본은 templates/hooks/에만 있다', () => {
    for (const script of ['check-design-tokens.mjs', 'check-story-exists.mjs']) {
      assert.ok(existsSync(repoPath('templates', 'hooks', script)));
    }
  });

  // 소비 프로젝트 cwd에는 templates/가 없다 — 소스가 플러그인 루트 기준이 아니면
  // 훅 opt-in 설치가 절차대로 실행 불가다(dogfood에선 cwd==플러그인 루트라 은폐되는 결함 클래스).
  it('omj-setup의 훅 복사 절차는 플러그인 루트 기준 소스 경로를 쓴다', () => {
    const body = readRepoFile('commands', 'omj-setup.md');
    assert.ok(
      body.includes('${CLAUDE_PLUGIN_ROOT}/templates/hooks/'),
      'omj-setup.md: 훅 복사 소스에 ${CLAUDE_PLUGIN_ROOT}/templates/hooks/ 표기가 필요합니다',
    );
  });
});

describe('commands/*.md frontmatter', () => {
  const commands = listCommandFiles();

  it('커맨드가 존재한다', () => {
    assert.ok(commands.length > 0);
  });

  for (const file of commands) {
    describe(file, () => {
      const fm = parseFrontmatter(readRepoFile('commands', file));

      it('frontmatter를 갖는다', () => {
        assert.ok(fm, `${file}에 frontmatter가 없습니다`);
      });

      it('description을 갖는다', () => {
        assert.ok(fm.description?.length > 0);
      });

      it('allowed-tools를 명시한다', () => {
        assert.ok(fm['allowed-tools']?.length > 0, `${file}에 allowed-tools 선언이 없습니다`);
      });

      // "권한을 빼는 것이 곧 안전 게이트를 강제하는 것"(PRINCIPLES ③)이 이 레포의 핵심 주장이다.
      // 주장만 문서에 적어 두면 다음 편집자가 조용히 깰 수 있으므로 여기서 못 박는다.
      it('스코프 없는 bare Bash를 선언하지 않는다', () => {
        assert.doesNotMatch(
          fm['allowed-tools'],
          /(^|,\s*)Bash\s*(,|$)/,
          `${file}: bare Bash는 임의 셸 실행 사전승인이다 — Bash(cmd:*)로 좁혀야 한다`,
        );
      });

      // Bash(command:*) 같은 실행 위임 builtin의 단독 prefix는 `command <아무거나>`를
      // 무프롬프트로 승인한다 — 스코프 문법을 쓰고도 bare Bash와 동등해지는 세탁 경로.
      // 인자까지 포함한 prefix(Bash(command -v:*))는 통과한다.
      it('실행 위임 builtin을 단독 prefix로 스코프하지 않는다', () => {
        assert.doesNotMatch(
          fm['allowed-tools'],
          /(^|,\s*)Bash\(\s*(command|eval|exec|source|sh|bash|zsh|env|xargs|sudo|nohup|time)\s*(:\*)?\s*\)/,
          `${file}: 실행 위임 builtin 단독 스코프는 사실상 bare Bash다 — 인자까지 좁혀야 한다(예: Bash(command -v:*))`,
        );
      });

      if (READ_ONLY_COMMANDS.has(file)) {
        // Task/Agent를 함께 막는 이유: 서브에이전트는 부모의 allowed-tools를 상속하지
        // 않으므로, 소집 선언 하나로 read-only 계약이 매니페스트 수준에서 무의미해진다.
        it('read-only 커맨드는 쓰기 도구·서브에이전트 소집을 선언하지 않는다', () => {
          assert.doesNotMatch(
            fm['allowed-tools'],
            /(^|,\s*)(Write|Edit|MultiEdit|NotebookEdit|Task|Agent)\b/,
            `${file}은 read-only 계약인데 쓰기 도구 또는 Task/Agent가 선언됐습니다`,
          );
        });
      }

      if (ZERO_BASH_COMMANDS.has(file)) {
        // "read-only(Write/Edit/Bash 없음)" 주장의 Bash 절반 — 이 단언이 없으면
        // 스코프 Bash 하나로 계약이 조용히 무너져도 어떤 테스트도 실패하지 않는다.
        it('zero-bash 커맨드는 어떤 Bash 스코프도 선언하지 않는다', () => {
          assert.doesNotMatch(
            fm['allowed-tools'],
            /(^|,\s*)Bash\b/,
            `${file}은 zero-bash 계약인데 Bash 토큰이 선언됐습니다`,
          );
        });
      }

      it('네임스페이스 2축 규칙을 지킨다 (/omj·/omj-* 또는 워크플로우 화이트리스트)', () => {
        assert.ok(
          /^omj(-[a-z-]+)?\.md$/.test(file) || WORKFLOW_COMMANDS.has(file),
          `${file}: FE 커맨드는 omj-* 접두, 워크플로우 커맨드는 WORKFLOW_COMMANDS 등재가 필요합니다`,
        );
      });
    });
  }
});

describe('agents/*.md frontmatter', () => {
  // 루프 기반 검사는 디렉터리가 비면 전부 공허 통과한다 — 존재 단언이 그 구멍을 막는다.
  it('번들 에이전트 3종이 실재한다', () => {
    assert.ok(listAgentFiles().length >= 3, 'agents/에 번들 3종(figma-implementer·design-qa·plan-critic)이 있어야 합니다');
  });

  for (const file of listAgentFiles()) {
    describe(file, () => {
      const fm = parseFrontmatter(readRepoFile('agents', file));

      it('name이 파일명과 일치한다', () => {
        assert.ok(fm, `${file}에 frontmatter가 없습니다`);
        assert.equal(fm.name, file.replace(/\.md$/, ''));
      });

      it('description과 tools를 갖는다', () => {
        assert.ok(fm.description?.length > 0);
        assert.ok(fm.tools?.length > 0);
      });
    });
  }

  // 에이전트 도구 계약 — ralplan.md·CHANGELOG의 "도구 표면이 테스트로 고정된다" 주장을
  // 실제로 참으로 만드는 단언. 이 단언이 없으면 계약은 선언 전용이고 회귀해도 침묵한다.
  it('plan-critic의 도구 표면은 정확히 Read, Grep, Glob이다 (read-only 적대 리뷰어)', () => {
    const fm = parseFrontmatter(readRepoFile('agents', 'plan-critic.md'));
    assert.deepEqual(
      fm.tools.split(',').map((t) => t.trim()).sort(),
      ['Glob', 'Grep', 'Read'],
      'plan-critic은 read-only 계약 — 도구 추가는 ralplan의 합의 신뢰 모델을 바꾸는 결정이다',
    );
  });

  it('design-qa는 쓰기 도구를 선언하지 않는다 (검사만, 소스 비수정)', () => {
    const fm = parseFrontmatter(readRepoFile('agents', 'design-qa.md'));
    assert.doesNotMatch(
      fm.tools,
      /(^|,\s*)(Write|Edit|MultiEdit|NotebookEdit)\b/,
      'design-qa는 검사 전용 — 쓰기 도구가 생기면 "검사만" 계약이 무너진다',
    );
  });
});

/**
 * 도구 선언 불변식 — 같은 결함 클래스가 3회 재발한 뒤 도입(ralplan 2026-08).
 * (a) MCP 이중 프리픽스: v0.4.0이 playwright에서 "설치 출처에 따라 도구명이 달라진다"를
 *     고쳤지만 figma·context7로 전파되지 않았다 — 테스트가 없어서였다.
 * (b) 호출 지점 없는 권한 선언: v0.4.0에서 3건 제거 후에도 재유입됐다.
 *     이 검사는 **언급 기반**이다(본문 어디든 명령 문자열이 단어 경계로 등장하면 통과) —
 *     구조적 단언이 아니라 성실성 의존 게이트임을 알고 유지하라. substring 매칭은
 *     한국어 산문의 우연 일치("command" 등)로 공허해져 단어 경계 정규식으로 강화했다.
 */
describe('도구 선언 불변식 (commands allowed-tools · agents tools)', () => {
  const surfaces = [
    ...listCommandFiles().map((f) => ({
      file: `commands/${f}`,
      source: readRepoFile('commands', f),
      field: 'allowed-tools',
    })),
    // 에이전트는 tools: 필드를 쓴다. 현재 에이전트는 bare Bash만 선언해 (b) 매칭 0건이
    // 정상이다(에이전트 tools는 scoped Bash 문법이 없다) — 공허 통과를 회귀로 오인하지 말 것.
    ...listAgentFiles().map((f) => ({
      file: `agents/${f}`,
      source: readRepoFile('agents', f),
      field: 'tools',
    })),
  ];

  const parsed = surfaces
    .map(({ file, source, field }) => {
      const fm = parseFrontmatter(source);
      const decl = fm?.[field];
      if (!decl) return null;
      return {
        file,
        tokens: decl.split(',').map((t) => t.trim()).filter(Boolean),
        body: source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''),
      };
    })
    .filter(Boolean);

  it('플러그인 경유 MCP 선언은 bare 서버 변형을 병기한다', () => {
    const violations = [];
    for (const { file, tokens } of parsed) {
      for (const token of tokens) {
        const m = /^mcp__plugin_(.+)__([A-Za-z0-9_*-]+)$/.exec(token);
        if (!m) continue;
        // bare 이름은 플러그인이 아니라 **MCP 서버** 이름에서 온다 —
        // `mcp__plugin_<plugin>_<server>__`의 마지막 `_` 세그먼트가 서버다.
        // 전제: 서버명에 `_`가 없다(현 서버 figma·context7·playwright 전부 안전).
        const server = m[1].split('_').pop();
        const tool = m[2];
        const ok =
          tokens.includes(`mcp__${server}__*`) ||
          (tool !== '*' && tokens.includes(`mcp__${server}__${tool}`));
        if (!ok) violations.push(`${file}: ${token} → bare mcp__${server}__${tool === '*' ? '*' : tool} 병기 필요`);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `raw MCP 등록(claude mcp add) 사용자는 플러그인 프리픽스 도구명이 없어 사전승인을 잃는다:\n${violations.join('\n')}`,
    );
  });

  it('bare MCP 선언은 플러그인 프리픽스 변형을 병기한다 (역방향)', () => {
    // 순방향(플러그인→bare)만 검사하면 bare 토큰만 선언한 파일이 통과한다 —
    // 플러그인 마켓플레이스 설치 사용자는 플러그인 프리픽스 도구명만 가지므로 사전승인을 잃는다.
    const KNOWN_SERVERS = new Set(['figma', 'context7', 'playwright']);
    const violations = [];
    for (const { file, tokens } of parsed) {
      for (const token of tokens) {
        const m = /^mcp__([A-Za-z0-9-]+)__([A-Za-z0-9_*-]+)$/.exec(token);
        if (!m || !KNOWN_SERVERS.has(m[1])) continue;
        const [, server, tool] = m;
        const ok = tokens.some((t) => {
          const pm = /^mcp__plugin_(.+)__([A-Za-z0-9_*-]+)$/.exec(t);
          if (!pm || pm[1].split('_').pop() !== server) return false;
          return pm[2] === '*' || pm[2] === tool;
        });
        if (!ok) violations.push(`${file}: ${token} → mcp__plugin_*_${server}__ 변형 병기 필요`);
      }
    }
    assert.deepEqual(violations, [], `이중 프리픽스 병기는 양방향이어야 한다:\n${violations.join('\n')}`);
  });

  it('Bash 선언은 frontmatter 제외 본문에 호출 지점이 있다', () => {
    const violations = [];
    for (const { file, tokens, body } of parsed) {
      for (const token of tokens) {
        const m = /^Bash\((.+)\)$/.exec(token);
        if (!m) continue;
        const cmd = m[1].replace(/:\*$/, '');
        // 단어 경계 매칭 — `command` 선언이 산문 속 "command" 조각으로 통과하는 공허를 막는다.
        // 뒤 경계는 cmd가 단어 문자로 끝날 때만 요구한다(`git add` vs `git addendum`) —
        // 경로 prefix처럼 비단어 문자로 끝나면 이어지는 파일명이 정당한 연속이다.
        const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const boundaryAfter = /[\w-]$/.test(cmd) ? '(?![\\w-])' : '';
        const callSite = new RegExp(`(^|[^\\w-])${escaped}${boundaryAfter}`);
        if (!callSite.test(body)) violations.push(`${file}: Bash(${m[1]}) — 본문에 호출 지점 "${cmd}" 없음`);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `본문 절차에 호출 지점이 없는 도구는 선언하지 않는다(CLAUDE.md):\n${violations.join('\n')}`,
    );
  });
});

describe('skills/frontend-fundamentals', () => {
  const fm = parseFrontmatter(readRepoFile('skills', 'frontend-fundamentals', 'SKILL.md'));

  it('name·description·license를 갖는다', () => {
    assert.equal(fm.name, 'frontend-fundamentals');
    assert.ok(fm.description?.length > 0);
    assert.equal(fm.license, 'MIT');
  });

  it('중첩 metadata가 온전히 파싱된다', () => {
    assert.equal(typeof fm.metadata, 'object');
    assert.match(fm.metadata.version, /^\d+\.\d+\.\d+$/);
    assert.ok(fm.metadata.author?.length > 0);
  });

  it('SKILL.md가 참조하는 references/ 파일이 모두 실재한다', () => {
    const source = readRepoFile('skills', 'frontend-fundamentals', 'SKILL.md');
    const referenced = [...source.matchAll(/\(references\/([\w-]+\.md)\)/g)].map((m) => m[1]);
    assert.ok(referenced.length > 0, 'references 링크를 찾지 못했습니다');

    for (const name of new Set(referenced)) {
      assert.ok(
        existsSync(repoPath('skills', 'frontend-fundamentals', 'references', name)),
        `references/${name}가 없습니다`,
      );
    }
  });
});
