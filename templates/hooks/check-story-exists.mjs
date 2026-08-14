#!/usr/bin/env node
/**
 * check-story-exists.mjs — PostToolUse(Edit|Write) 훅: 컴포넌트 저장 시 Story 누락 경고.
 *
 * 배포: oh-my-joy 플러그인 templates/hooks/ 정본 → /omj-setup이 소비 프로젝트
 * .claude/hooks/ 로 복사하고 .claude/settings.json 에 등록한다(opt-in).
 * 게이트: 프로젝트 루트 .omj/fe-context.md 에 `storybook: true` 선언이 없으면 무조건 no-op.
 * 검사만 하고 수정·차단하지 않는다(경고 컨텍스트 주입, exit 0).
 *
 * **자기완결 제약**: /omj-setup은 이 파일 하나만 복사하므로 공용 모듈을 import하지 않는다.
 *
 * **"컴포넌트"의 정의가 이 훅의 정확도를 결정한다.** `.tsx`라고 전부 Story 대상이 아니다 —
 * Next.js App Router의 예약 파일(page/layout/route…)은 라우팅 진입점이고, 소문자로 시작하는
 * 파일은 관례상 훅·유틸이다. 이들을 걸러내지 않으면 경고가 상시 발화해 무시당한다.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const COMPONENT_EXT = /\.(tsx|jsx)$/;

/** 이 훅이 발화하는 도구. 소비 프로젝트 matcher가 넓어져도 비변경 도구에선 침묵한다. */
const MUTATING_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** Story를 쓰지 않는 파일들 — 테스트/스토리 자신과 Next.js App Router 예약 파일. */
const NOT_A_COMPONENT = /\.(stories|test|spec)\.|^(page|layout|template|loading|error|global-error|not-found|route|default|middleware|instrumentation)\./;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function findFeContext(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const p = path.join(dir, '.omj', 'fe-context.md');
    if (existsSync(p)) return p;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const listFiles = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return null;
  }
};

const input = readStdin();
if (!input) process.exit(0);

if (input.tool_name && !MUTATING_TOOLS.has(input.tool_name)) process.exit(0);

const filePath = input.tool_input?.file_path ?? '';
if (!COMPONENT_EXT.test(filePath)) process.exit(0);

// 제외 판정은 파일명 기준이다 — 전체 경로로 보면 `^page\.`류 앵커가 절대 매치되지 않는다.
const fileName = path.basename(filePath);
if (NOT_A_COMPONENT.test(fileName)) process.exit(0);

const cwd = input.cwd || process.cwd();
const fcPath = findFeContext(cwd);
if (!fcPath) process.exit(0);

let feContext;
try {
  feContext = readFileSync(fcPath, 'utf8');
} catch {
  process.exit(0); // 판독 불가(디렉터리·권한 등) → 검사 전용 훅이 세션을 막지 않는다(fail-open)
}
if (!/^storybook:\s*true\s*$/m.test(feContext)) process.exit(0);

// 경로 기준점은 훅 계약이 준 cwd 하나로 통일한다.
const projectRoot = path.dirname(path.dirname(fcPath));
const resolved = path.resolve(cwd, filePath);

// 프로젝트 밖 파일은 이름조차 컨텍스트로 내보내지 않고 디렉터리도 열지 않는다.
// (자매 훅 check-design-tokens.mjs와 같은 봉쇄 규칙 — 두 훅의 기준을 갈라 두지 않는다.
//  `resolved !== projectRoot`는 파일 경로라 항상 참이지만 대칭 유지를 위해 남긴다.)
if (resolved !== projectRoot && !resolved.startsWith(projectRoot + path.sep)) process.exit(0);

const dir = path.dirname(resolved);
const stem = path.basename(resolved).replace(COMPONENT_EXT, '');

// `Button/index.tsx` 배럴 패턴에서는 형제 Story가 `Button.stories.tsx`다 — 파일명이 아니라
// 디렉터리명이 컴포넌트 이름이므로 둘 다 후보로 본다.
const candidates = stem === 'index' ? [path.basename(dir), stem] : [stem];

// 소문자로 시작하면 관례상 훅·유틸이다(`useModal.tsx`, `utils.tsx`). index는 위에서 이미 해소됐다.
if (!/^[A-Z]/.test(candidates[0])) process.exit(0);

/**
 * Story 탐색 위치. 기본은 형제 파일이고, Story를 별도 디렉터리에 모으는 프로젝트는
 * fe-context에 `storiesDir:`를 선언해 알린다(축은 프로젝트가 선언 — PRINCIPLES ⑩).
 */
const storiesDirMatch = feContext.match(/^storiesDir:\s*(\S+)/m);
const searchDirs = [dir];
if (storiesDirMatch) searchDirs.push(path.resolve(projectRoot, storiesDirMatch[1]));

// 읽을 수 없는 디렉터리는 "Story 없음"의 근거로도, "Story 있음"의 근거로도 쓰지 않는다.
// 이걸 `true`로 승격하면 storiesDir 오타 하나가 `.some()`을 단락시켜 훅이 프로젝트
// 전체에서 영구 침묵한다 — 읽히는 디렉터리가 하나라도 있으면 그것으로 판정한다.
const readable = searchDirs.map(listFiles).filter(Boolean);
if (readable.length === 0) process.exit(0);

const hasStory = readable.some((entries) =>
  entries.some((f) => candidates.some((name) => f.startsWith(`${name}.stories.`))),
);
if (hasStory) process.exit(0);

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `[omj:check-story-exists] ${fileName}에 대응하는 ${candidates[0]}.stories.* 가 없습니다 — 이 프로젝트는 storybook: true 선언 상태입니다(Story 추가 권장).`,
    },
  }),
);
process.exit(0);
