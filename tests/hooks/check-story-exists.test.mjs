/**
 * check-story-exists.mjs 계약 테스트.
 *
 * 게이트는 `storybook: true` 선언 하나뿐이다 — 선언하지 않은 프로젝트에서는
 * 어떤 입력에도 침묵해야 한다(PRINCIPLES ⑩ — 축을 플러그인이 강제하지 않는다).
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

import { runHook, makeProject, postToolUsePayload } from '../helpers/repo.mjs';

const projects = [];
const COMPONENT = 'export const Button = () => <button />;\n';

function checkFile(relativePath, files = {}, { feContext = 'storybook: true\n' } = {}) {
  const tree = { [relativePath]: COMPONENT, ...files };
  if (feContext !== null) tree['.omj/fe-context.md'] = feContext;

  const project = makeProject(tree);
  projects.push(project);
  return runHook(
    'check-story-exists.mjs',
    postToolUsePayload({ cwd: project.root, filePath: project.file(relativePath) }),
  );
}

after(() => projects.forEach((p) => p.cleanup()));

describe('check-story-exists — 게이트', () => {
  it('fe-context.md가 없으면 no-op', () => {
    assert.equal(checkFile('src/Button.tsx', {}, { feContext: null }).stdout, '');
  });

  it('fe-context.md가 판독 불가(디렉터리)여도 no-op — fail-open (자매 훅과 같은 계약)', () => {
    const project = makeProject({ '.omj/fe-context.md/placeholder': '', 'src/Button.tsx': COMPONENT });
    projects.push(project);
    const result = runHook(
      'check-story-exists.mjs',
      postToolUsePayload({ cwd: project.root, filePath: project.file('src/Button.tsx') }),
    );
    assert.equal(result.stdout, '');
  });

  it('storybook: true 선언이 없으면 no-op', () => {
    assert.equal(checkFile('src/Button.tsx', {}, { feContext: 'tokensPath: src/t.css\n' }).stdout, '');
  });

  it('storybook: false는 활성화가 아니다', () => {
    assert.equal(checkFile('src/Button.tsx', {}, { feContext: 'storybook: false\n' }).stdout, '');
  });

  it('파싱 불가 stdin에서도 죽지 않는다', () => {
    assert.equal(runHook('check-story-exists.mjs', 'not-json{', { raw: true }).stdout, '');
  });

  it('빈 stdin에서도 죽지 않는다', () => {
    assert.equal(runHook('check-story-exists.mjs', '', { raw: true }).stdout, '');
  });

  it('변경 도구가 아니면 침묵한다 — matcher가 넓어져도 안전하게', () => {
    const project = makeProject({ '.omj/fe-context.md': 'storybook: true\n', 'src/Button.tsx': COMPONENT });
    projects.push(project);
    const payload = postToolUsePayload({
      cwd: project.root,
      filePath: project.file('src/Button.tsx'),
      toolName: 'Read',
    });
    assert.equal(runHook('check-story-exists.mjs', payload).stdout, '');
  });

  it('프로젝트 밖 절대경로 파일은 읽지 않는다 — 자매 훅과 같은 봉쇄 규칙', () => {
    const project = makeProject({ '.omj/fe-context.md': 'storybook: true\n' });
    projects.push(project);
    const outsider = makeProject({ 'Secret.tsx': COMPONENT });
    projects.push(outsider);

    const payload = postToolUsePayload({ cwd: project.root, filePath: outsider.file('Secret.tsx') });
    assert.equal(runHook('check-story-exists.mjs', payload).stdout, '');
  });
});

describe('check-story-exists — 탐지', () => {
  it('Story가 없는 컴포넌트를 경고한다', () => {
    const result = checkFile('src/Button.tsx');
    assert.match(result.context, /Button\.stories\.\* 가 없습니다/);
  });

  it('같은 디렉터리에 Story가 있으면 조용하다', () => {
    const result = checkFile('src/Button.tsx', { 'src/Button.stories.tsx': 'export default {};\n' });
    assert.equal(result.stdout, '');
  });

  it('확장자가 달라도 Story로 인정한다', () => {
    const result = checkFile('src/Button.tsx', { 'src/Button.stories.mdx': '# Button\n' });
    assert.equal(result.stdout, '');
  });
});

describe('check-story-exists — 제외 대상', () => {
  const excluded = {
    'src/Button.stories.tsx': 'Story 파일 자신',
    'src/Button.test.tsx': '테스트 파일',
    'src/Button.spec.tsx': 'spec 파일',
  };

  for (const [file, label] of Object.entries(excluded)) {
    it(`${label}은 검사하지 않는다`, () => {
      assert.equal(checkFile(file).stdout, '');
    });
  }

  it('컴포넌트가 아닌 확장자는 검사하지 않는다', () => {
    assert.equal(checkFile('src/util.ts').stdout, '');
  });
});

describe('check-story-exists — Next.js App Router 예약 파일', () => {
  // 라우팅 진입점은 Story 대상이 아니다. 이걸 거르지 않으면 App Router 프로젝트에서 상시 발화한다.
  const reserved = [
    'page.tsx',
    'layout.tsx',
    'template.tsx',
    'loading.tsx',
    'error.tsx',
    'global-error.tsx',
    'not-found.tsx',
    'route.tsx',
    'default.tsx',
    'middleware.tsx',
    'instrumentation.tsx',
  ];

  for (const file of reserved) {
    it(`app/dashboard/${file}은 검사하지 않는다`, () => {
      assert.equal(checkFile(`app/dashboard/${file}`).stdout, '');
    });
  }
});

describe('check-story-exists — 컴포넌트 판별', () => {
  it('배럴 패턴에서 디렉터리명 Story를 인정한다', () => {
    const result = checkFile('src/components/Button/index.tsx', {
      'src/components/Button/Button.stories.tsx': 'export default {};\n',
    });
    assert.equal(result.stdout, '');
  });

  it('배럴 패턴에 Story가 없으면 디렉터리명으로 경고한다', () => {
    const result = checkFile('src/components/Button/index.tsx');
    assert.match(result.context, /Button\.stories\.\* 가 없습니다/);
  });

  it('소문자로 시작하는 파일은 훅·유틸 관례로 보고 검사하지 않는다', () => {
    assert.equal(checkFile('src/useModal.tsx').stdout, '');
    assert.equal(checkFile('src/formatDate.tsx').stdout, '');
  });
});

describe('check-story-exists — storiesDir 선언', () => {
  it('Story를 별도 디렉터리에 모으는 프로젝트를 지원한다', () => {
    const result = checkFile(
      'src/Button.tsx',
      { 'stories/Button.stories.tsx': 'export default {};\n' },
      { feContext: 'storybook: true\nstoriesDir: stories\n' },
    );
    assert.equal(result.stdout, '');
  });

  it('선언된 디렉터리에도 Story가 없으면 경고한다', () => {
    const result = checkFile(
      'src/Button.tsx',
      { 'stories/Other.stories.tsx': 'export default {};\n' },
      { feContext: 'storybook: true\nstoriesDir: stories\n' },
    );
    assert.match(result.context, /Button\.stories\.\* 가 없습니다/);
  });

  // 오타 한 글자가 훅을 프로젝트 전체에서 무음으로 만들면 안 된다 —
  // 읽을 수 없는 디렉터리는 "Story 있음"의 근거가 될 수 없다.
  it('storiesDir 선언이 잘못돼도 형제 디렉터리 판정을 삼키지 않는다', () => {
    const result = checkFile(
      'src/Button.tsx',
      {},
      { feContext: 'storybook: true\nstoriesDir: stroies\n' },
    );
    assert.match(result.context, /Button\.stories\.\* 가 없습니다/);
  });

  it('탐색할 디렉터리를 하나도 읽을 수 없으면 침묵한다', () => {
    const project = makeProject({ '.omj/fe-context.md': 'storybook: true\n' });
    projects.push(project);
    // 파일이 실재하지 않으므로 형제 디렉터리도 읽을 수 없다 → 판정 근거 없음 → 침묵
    const payload = postToolUsePayload({
      cwd: project.root,
      filePath: project.file('missing/deeply/Button.tsx'),
    });
    assert.equal(runHook('check-story-exists.mjs', payload).stdout, '');
  });
});
