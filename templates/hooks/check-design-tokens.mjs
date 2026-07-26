#!/usr/bin/env node
/**
 * check-design-tokens.mjs — PostToolUse(Edit|Write) 훅: 하드코딩 색상 감지 경고.
 *
 * 배포: oh-my-joy 플러그인 templates/hooks/ 정본 → /omj-setup이 소비 프로젝트
 * .claude/hooks/ 로 복사하고 .claude/settings.json 에 등록한다(opt-in).
 * 게이트: 프로젝트 루트 .omj/fe-context.md 에 tokensPath 선언이 없으면 무조건 no-op.
 * 검사만 하고 수정·차단하지 않는다(경고 컨텍스트 주입, exit 0).
 *
 * **자기완결 제약**: /omj-setup은 이 파일 하나만 복사한다. 따라서 공용 모듈을
 * import하지 않는다 — check-story-exists.mjs와 겹치는 헬퍼가 있어도 각자 들고 있는
 * 편이 배포 계약에 맞다(공유 모듈을 만들면 복사본이 런타임에 깨진다).
 *
 * **오탐보다 미탐을 택한다**: 이 훅은 차단하지 않는 경고라 오탐이 쌓이면 사용자가
 * 통째로 무시하게 된다. 그래서 색상인지 식별자인지 구문 없이 구분할 수 없는 위치
 * (자유 위치의 네임드 컬러, DOM id 등)는 검사하지 않는다. 개별 오탐은 해당 줄에
 * `omj-allow-color` 주석으로 끈다.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** CSS-in-JS·테마 객체는 .ts에, 스타일은 .css/.scss에 산다 — 둘 다 색상이 하드코딩되는 자리다. */
const TARGET_EXT = /\.(tsx|jsx|ts|mts|cts|css|scss|sass|less)$/;

/** 이 훅이 발화하는 도구. 소비 프로젝트 matcher가 넓어져도 비변경 도구에선 침묵한다. */
const MUTATING_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** 해당 줄의 경고를 끄는 인라인 주석(eslint-disable-line과 같은 역할). */
const SUPPRESSION = /omj-allow-color/;

/** #RGB · #RGBA · #RRGGBB · #RRGGBBAA 만 CSS 색상이다 — 5·7자리는 색상이 아니다. */
const HEX_COLOR =
  /(?<![\w#.$-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g;

/** 긴 이름을 먼저 둬 `rgba(`가 `rgb`로 잘려 매칭되지 않게 한다. */
const COLOR_FUNCTIONS = ['oklch', 'oklab', 'rgba', 'hsla', 'rgb', 'hsl', 'hwb', 'lab', 'lch'];

/**
 * CSS 선언 위치의 네임드 컬러만 본다. 자유 위치의 `red`/`black`은 변수명·Tailwind
 * 클래스 조각과 구분할 수 없어 검사 대상에서 뺀다(미탐 > 오탐).
 */
const NAMED_COLOR_DECLARATION = new RegExp(
  // 속성 위치: CSS 커스텀 프로퍼티, `*color` 계열, 색상을 값으로 받는 단축 속성
  String.raw`(?:^|[;{])\s*(?:--[\w-]+|[\w-]*colou?r|background|border(?:-(?:top|right|bottom|left))?|outline|fill|stroke|box-shadow|text-shadow)\s*:\s*[^;{}]*?` +
    String.raw`\b(?:black|white|red|blue|green|yellow|orange|purple|pink|gray|grey|silver|gold|brown|cyan|magenta|navy|teal|olive|maroon|lime|aqua|fuchsia)\b`,
  'g',
);

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

/** 라인 수와 열 위치를 보존하며 지운다 — 리포트의 L번호가 원본과 어긋나지 않게. */
const blankOut = (text) => text.replace(/[^\n]/g, ' ');

/**
 * 색상 리터럴이 아닌 것이 확실한 구간을 지운다. 지우는 순서가 중요하다 —
 * 주석을 먼저 지워야 주석 안의 `url(`·`href=`가 다음 단계를 교란하지 않는다.
 */
function maskNonColorRegions(source) {
  return (
    source
      // 블록 주석과 JSX 주석(`{/* … */}`)
      .replace(/\/\*[\s\S]*?\*\//g, blankOut)
      // 줄 주석. `https://`가 지워지지 않도록 `:` 뒤의 `//`는 건드리지 않는다.
      .replace(/(^|[^:\\])\/\/[^\n]*/gm, (match, prefix) => prefix + blankOut(match.slice(prefix.length)))
      // SVG·CSS의 `url(#gradient)` — id 참조이지 색상이 아니다.
      .replace(/\burl\(([^)\n]*)\)/g, (_match, inner) => `url(${blankOut(inner)})`)
      // 앵커·라우터 경로의 `#section` 프래그먼트
      .replace(/((?:href|to|xlinkHref)\s*=\s*["'`])([^"'`\n]*)/g, (_match, prefix, value) => prefix + blankOut(value))
  );
}

/**
 * 색상 함수 호출을 센다. 인자에 `var(`가 있으면 토큰을 참조하는 정상 패턴이므로
 * 위반이 아니다 — `hsl(var(--h) var(--s) var(--l))`가 그렇다. 중첩 괄호 때문에
 * 정규식만으로는 인자 경계를 못 잡아 괄호 깊이를 직접 센다.
 */
function countColorFunctions(line) {
  const pattern = new RegExp(String.raw`(?<![\w-])(?:${COLOR_FUNCTIONS.join('|')})\(`, 'gi');
  let count = 0;
  let match;

  while ((match = pattern.exec(line)) !== null) {
    const openIndex = match.index + match[0].length - 1;
    let depth = 0;
    let cursor = openIndex;
    for (; cursor < line.length; cursor++) {
      if (line[cursor] === '(') depth++;
      else if (line[cursor] === ')' && --depth === 0) break;
    }
    if (!/var\(/.test(line.slice(openIndex + 1, cursor))) count++;
  }
  return count;
}

function countViolations(line) {
  return (
    (line.match(HEX_COLOR)?.length ?? 0) +
    countColorFunctions(line) +
    (line.match(NAMED_COLOR_DECLARATION)?.length ?? 0)
  );
}

const input = readStdin();
if (!input) process.exit(0);

// tool_name이 없는 입력(수동 실행·테스트)은 통과시키고, 명시된 경우에만 거른다.
if (input.tool_name && !MUTATING_TOOLS.has(input.tool_name)) process.exit(0);

const filePath = input.tool_input?.file_path ?? '';
if (!TARGET_EXT.test(filePath)) process.exit(0);

const cwd = input.cwd || process.cwd();
const fcPath = findFeContext(cwd);
if (!fcPath) process.exit(0); // fe-context 미선언 프로젝트 → no-op (범용성)

const tokensPathMatch = readFileSync(fcPath, 'utf8').match(/^tokensPath:\s*(\S+)/m);
if (!tokensPathMatch) process.exit(0); // 토큰 시스템 미선언 → no-op

// 경로 기준점은 훅 계약이 준 cwd 하나로 통일한다. filePath가 절대경로면 그대로 유지된다.
const projectRoot = path.dirname(path.dirname(fcPath));
const resolved = path.resolve(cwd, filePath);

// 프로젝트 밖 파일은 읽지 않는다 — 훅이 무관한 파일 내용을 컨텍스트로 흘리지 않게.
if (resolved !== projectRoot && !resolved.startsWith(projectRoot + path.sep)) process.exit(0);

// 토큰 정의 파일 자체는 raw 값이 정상이므로 제외.
// 디렉터리 통째 제외는 토큰 "전용" 디렉터리(이름에 token 포함)일 때만 — 공유 디렉터리(예: src/styles/)에
// 토큰이 선언된 경우 그 디렉터리의 비-토큰 파일까지 검사에서 빠지는 것을 막는다.
const tokensFile = path.resolve(projectRoot, tokensPathMatch[1]);
const tokensDir = path.dirname(tokensFile);
const dirIsTokenOnly = /token/i.test(path.basename(tokensDir));
if (resolved === tokensFile || (dirIsTokenOnly && resolved.startsWith(tokensDir + path.sep))) {
  process.exit(0);
}

let source = '';
try {
  source = readFileSync(resolved, 'utf8');
} catch {
  process.exit(0);
}

const originalLines = source.split('\n');
const hits = [];
let total = 0;

maskNonColorRegions(source)
  .split('\n')
  .forEach((line, index) => {
    if (SUPPRESSION.test(originalLines[index] ?? '')) return;
    const count = countViolations(line);
    if (count === 0) return;
    total += count;
    hits.push(`L${index + 1}: ${(originalLines[index] ?? '').trim().slice(0, 80)}`);
  });

if (total === 0) process.exit(0);

const scope = hits.length === 1 ? '' : ` (${hits.length}개 라인)`;
const context = [
  `[omj:check-design-tokens] ${path.basename(resolved)}에 하드코딩 색상 ${total}건${scope} 감지 — 프로젝트 토큰(${tokensPathMatch[1]})의 시맨틱 값 사용을 권장:`,
  ...hits.slice(0, 5),
  hits.length > 5 ? `… 외 ${hits.length - 5}개 라인` : '',
  '오탐이면 해당 줄에 `omj-allow-color` 주석을 붙여 끕니다.',
]
  .filter(Boolean)
  .join('\n');

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context },
  }),
);
process.exit(0);
