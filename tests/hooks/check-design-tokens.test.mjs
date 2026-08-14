/**
 * check-design-tokens.mjs 계약 테스트.
 *
 * 이 훅의 설계 계약은 세 가지다:
 *   ① fe-context 미선언 프로젝트에서는 **무조건 no-op** (PRINCIPLES ⑩ — 범용성)
 *   ② 검사만 하고 차단하지 않는다 (항상 exit 0)
 *   ③ 토큰 정의 파일 자체는 raw 값이 정상이므로 제외
 * 아래 테스트는 그 계약과, 오탐이 실제 개발 흐름을 방해하지 않는지를 고정한다.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

import { runHook, makeProject, postToolUsePayload } from '../helpers/repo.mjs';

const FE_CONTEXT = 'tokensPath: src/tokens/colors.css\n';
const projects = [];

/** fe-context가 선언된 소비 프로젝트에서 대상 파일을 저장했을 때의 훅 출력. */
function checkFile(relativePath, source, { feContext = FE_CONTEXT } = {}) {
  const files = { [relativePath]: source, 'src/tokens/colors.css': ':root { --color-fg: #111111; }\n' };
  if (feContext !== null) files['.omj/fe-context.md'] = feContext;

  const project = makeProject(files);
  projects.push(project);
  return runHook(
    'check-design-tokens.mjs',
    postToolUsePayload({ cwd: project.root, filePath: project.file(relativePath) }),
  );
}

after(() => projects.forEach((p) => p.cleanup()));

describe('check-design-tokens — 게이트(범용성 보장)', () => {
  it('fe-context.md가 없으면 no-op — 선언하지 않은 프로젝트에 노이즈를 내지 않는다', () => {
    const result = checkFile('src/Button.tsx', 'const s = { color: "#ff0000" };\n', { feContext: null });
    assert.equal(result.stdout, '');
  });

  it('fe-context.md가 판독 불가(디렉터리)여도 no-op — 검사 훅이 세션을 막지 않는다(fail-open)', () => {
    // existsSync는 통과하지만 readFileSync가 EISDIR로 실패하는 케이스 —
    // try/catch 없이는 uncaught exception이 exit 1로 새어 fail-open 계약이 깨진다.
    const project = makeProject({
      '.omj/fe-context.md/placeholder': '',
      'src/Button.tsx': 'const s = { color: "#ff0000" };\n',
    });
    projects.push(project);
    const result = runHook(
      'check-design-tokens.mjs',
      postToolUsePayload({ cwd: project.root, filePath: project.file('src/Button.tsx') }),
    );
    assert.equal(result.stdout, '');
  });

  it('fe-context는 있으나 tokensPath 미선언이면 no-op', () => {
    const result = checkFile('src/Button.tsx', 'const s = { color: "#ff0000" };\n', {
      feContext: 'storybook: true\n',
    });
    assert.equal(result.stdout, '');
  });

  it('파싱 불가 stdin에서도 죽지 않는다', () => {
    assert.equal(runHook('check-design-tokens.mjs', 'not-json{', { raw: true }).stdout, '');
  });

  it('빈 stdin에서도 죽지 않는다', () => {
    assert.equal(runHook('check-design-tokens.mjs', '', { raw: true }).stdout, '');
  });

  it('JSON이지만 객체가 아닌 stdin도 죽지 않는다', () => {
    assert.equal(runHook('check-design-tokens.mjs', 'not-json').stdout, '');
  });
});

describe('check-design-tokens — 탐지', () => {
  it('하드코딩 hex를 경고한다', () => {
    const result = checkFile('src/Button.tsx', 'export const s = { background: "#ff0000" };\n');
    assert.match(result.context, /하드코딩 색상 1건/);
    assert.match(result.context, /src\/tokens\/colors\.css/);
  });

  it('rgba()도 경고한다', () => {
    const result = checkFile('src/Card.css', '.card { box-shadow: 0 0 4px rgba(0, 0, 0, 0.2); }\n');
    assert.match(result.context, /하드코딩 색상 1건/);
  });

  it('시맨틱 토큰만 쓰면 조용하다', () => {
    const result = checkFile(
      'src/Button.tsx',
      'export const Button = () => <button className="bg-surface-primary text-fg-default" />;\n',
    );
    assert.equal(result.stdout, '');
  });

  it('var() 참조는 위반이 아니다', () => {
    const result = checkFile('src/Card.css', '.card { color: var(--color-fg-default); }\n');
    assert.equal(result.stdout, '');
  });

  it('토큰 정의 파일 자체는 검사 대상에서 제외한다', () => {
    const project = makeProject({
      '.omj/fe-context.md': FE_CONTEXT,
      'src/tokens/colors.css': ':root { --color-fg: #111111; --color-bg: #ffffff; }\n',
    });
    projects.push(project);
    const result = runHook(
      'check-design-tokens.mjs',
      postToolUsePayload({ cwd: project.root, filePath: project.file('src/tokens/colors.css') }),
    );
    assert.equal(result.stdout, '');
  });

  it('경고는 5개 라인까지만 나열하고 나머지는 개수로 접는다', () => {
    const source = Array.from({ length: 8 }, (_, i) => `  --c${i}: #ff00${i}${i};`).join('\n');
    const result = checkFile('src/palette.css', `:root {\n${source}\n}\n`);
    assert.match(result.context, /하드코딩 색상 8건 \(8개 라인\)/);
    assert.match(result.context, /… 외 3개 라인/);
  });

  it('한 줄에 여러 색상이 있으면 라인 수가 아니라 색상 수를 센다', () => {
    const result = checkFile('src/theme.css', '.a { color: #ff0000; background: #00ff00; border-color: #0000ff; }\n');
    assert.match(result.context, /하드코딩 색상 3건/);
    assert.doesNotMatch(result.context, /개 라인\) 감지/); // 단일 라인이면 라인 수를 붙이지 않는다
  });
});

describe('check-design-tokens — 오탐 방지', () => {
  it('SVG url(#id) 참조를 색상으로 오인하지 않는다', () => {
    const result = checkFile('src/Icon.tsx', 'export const Icon = () => <rect fill="url(#grad1)" />;\n');
    assert.equal(result.stdout, '');
  });

  it('앵커 링크·DOM id 셀렉터를 색상으로 오인하지 않는다', () => {
    const result = checkFile(
      'src/Nav.tsx',
      'export const Nav = () => <a href="/docs#faq">FAQ</a>;\nconst el = document.querySelector("#app-root");\n',
    );
    assert.equal(result.stdout, '');
  });

  it('색상 길이를 넘는 긴 해시(커밋 SHA 등)는 색상이 아니다', () => {
    const result = checkFile('src/meta.tsx', 'export const commit = "#1234567890abcdef";\n');
    assert.equal(result.stdout, '');
  });

  it('주석 안의 옛 색상은 경고하지 않는다 — 라인 선두 주석', () => {
    const result = checkFile('src/Button.tsx', '// legacy palette: #ff0000\nexport const Button = () => null;\n');
    assert.equal(result.stdout, '');
  });

  it('주석 안의 옛 색상은 경고하지 않는다 — 코드 뒤 인라인 주석', () => {
    const result = checkFile(
      'src/Button.tsx',
      'export const Button = () => null; // legacy palette was #ff0000\n',
    );
    assert.equal(result.stdout, '');
  });

  it('블록 주석 안의 색상은 경고하지 않는다', () => {
    const result = checkFile('src/Button.tsx', '/*\n  before: #ff0000\n*/\nexport const Button = () => null;\n');
    assert.equal(result.stdout, '');
  });
});

describe('check-design-tokens — 대상 확장자', () => {
  const violation = 'export const theme = { bg: "#ff0000" };\n';

  for (const file of ['src/Button.tsx', 'src/Button.jsx', 'src/button.css']) {
    it(`${file}을 검사한다`, () => {
      assert.match(checkFile(file, violation).context, /하드코딩 색상/);
    });
  }

  // styled-components·theme 객체·CSS-in-TS는 .ts/.scss에 사는 일이 흔하다.
  for (const file of ['src/theme.ts', 'src/button.scss']) {
    it(`${file}도 검사한다`, () => {
      assert.match(checkFile(file, violation).context, /하드코딩 색상/);
    });
  }

  it('검사 대상이 아닌 확장자는 건너뛴다', () => {
    assert.equal(checkFile('README.md', '색상은 #ff0000 입니다.\n').stdout, '');
  });
});

describe('check-design-tokens — 최신 CSS 색상 문법', () => {
  // Tailwind v4·shadcn 생태계는 hsl()/oklch()가 주 색상 문법이다.
  const modern = {
    'hsl()': '--background: hsl(0 0% 100%);',
    'oklch()': '--brand: oklch(0.63 0.19 250);',
    'hwb()': 'color: hwb(194 0% 0%);',
    'lab()': 'color: lab(52% 40 60);',
  };

  for (const [label, declaration] of Object.entries(modern)) {
    it(`${label}를 탐지한다`, () => {
      assert.match(checkFile('src/theme.css', `:root { ${declaration} }\n`).context, /하드코딩 색상 1건/);
    });
  }

  it('var()로 감싼 색상 함수는 토큰 사용이므로 위반이 아니다', () => {
    const result = checkFile('src/theme.css', '.a { color: hsl(var(--h) var(--s) var(--l)); }\n');
    assert.equal(result.stdout, '');
  });

  it('멀티라인 색상 함수의 var() 인자도 위반이 아니다', () => {
    const source = '.a {\n  color: hsl(\n    var(--h) var(--s) var(--l)\n  );\n}\n';
    assert.equal(checkFile('src/theme.css', source).stdout, '');
  });

  it('색상 라이브러리 메서드 호출은 색상 리터럴이 아니다', () => {
    const source = 'export const c = chroma.lab(50, 0, 0);\nexport const d = (x) => d3.rgb(x).darker();\n';
    assert.equal(checkFile('src/color.ts', source).stdout, '');
  });

  it('CSS 선언 위치의 네임드 컬러를 탐지한다', () => {
    assert.match(checkFile('src/a.css', '.a { border: 1px solid black; }\n').context, /하드코딩 색상 1건/);
  });

  it('background-image의 네임드 컬러도 탐지한다', () => {
    const result = checkFile('src/a.css', '.a { background-image: linear-gradient(red, blue); }\n');
    assert.match(result.context, /하드코딩 색상/);
  });

  it('색상 이름을 담은 토큰 참조는 위반이 아니다 — 훅이 권장하는 사용법이다', () => {
    const source = ':root { --brand: var(--color-red-500); }\n.a { background: var(--gray-100); }\n';
    assert.equal(checkFile('src/theme.css', source).stdout, '');
  });

  it('색상 이름이 든 토큰 표기(red.500)를 위반으로 보지 않는다', () => {
    assert.equal(checkFile('src/theme.ts', 'export const s = { color: "red.500" };\n').stdout, '');
  });

  it('한 줄에 여러 프로퍼티가 있어도 앞 속성이 뒤 속성 값을 삼키지 않는다', () => {
    const source = 'export type P = { color: string, tone: "red" | "blue" };\n';
    assert.equal(checkFile('src/types.ts', source).stdout, '');
  });

  it('자유 위치의 색상 이름은 식별자와 구분할 수 없으므로 검사하지 않는다', () => {
    const source = 'const red = 1;\nexport const cls = "text-red-500 bg-black";\n';
    assert.equal(checkFile('src/Badge.tsx', source).stdout, '');
  });
});

describe('check-design-tokens — 억제와 봉쇄', () => {
  it('omj-allow-color 주석이 있는 줄은 경고하지 않는다', () => {
    const source = '.brand { color: #ff0000; } /* omj-allow-color: 외부 SDK 고정색 */\n';
    assert.equal(checkFile('src/vendor.css', source).stdout, '');
  });

  it('프로젝트 밖 절대경로 파일은 읽지 않는다', () => {
    const project = makeProject({ '.omj/fe-context.md': FE_CONTEXT });
    projects.push(project);
    const outsider = makeProject({ 'evil.css': '.a { color: #ff0000; }\n' });
    projects.push(outsider);

    const result = runHook(
      'check-design-tokens.mjs',
      postToolUsePayload({ cwd: project.root, filePath: outsider.file('evil.css') }),
    );
    assert.equal(result.stdout, '');
  });

  it('변경 도구가 아니면 침묵한다 — matcher가 넓어져도 안전하게', () => {
    const project = makeProject({
      '.omj/fe-context.md': FE_CONTEXT,
      'src/a.css': '.a { color: #ff0000; }\n',
    });
    projects.push(project);

    const payload = postToolUsePayload({
      cwd: project.root,
      filePath: project.file('src/a.css'),
      toolName: 'Read',
    });
    assert.equal(runHook('check-design-tokens.mjs', payload).stdout, '');
  });
});
