/**
 * Contract tests for check-story-exists.mjs.
 *
 * The gate is the single `storybook: true` declaration — in projects that did not declare it,
 * the hook must stay silent on any input (PRINCIPLES ⑩ — the plugin forces no axes).
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

describe('check-story-exists — gate', () => {
  it('no-op without fe-context.md', () => {
    assert.equal(checkFile('src/Button.tsx', {}, { feContext: null }).stdout, '');
  });

  it('no-op even when fe-context.md is unreadable (a directory) — fail-open (same contract as the sibling hook)', () => {
    const project = makeProject({ '.omj/fe-context.md/placeholder': '', 'src/Button.tsx': COMPONENT });
    projects.push(project);
    const result = runHook(
      'check-story-exists.mjs',
      postToolUsePayload({ cwd: project.root, filePath: project.file('src/Button.tsx') }),
    );
    assert.equal(result.stdout, '');
  });

  it('no-op without a storybook: true declaration', () => {
    assert.equal(checkFile('src/Button.tsx', {}, { feContext: 'tokensPath: src/t.css\n' }).stdout, '');
  });

  it('storybook: false is not activation', () => {
    assert.equal(checkFile('src/Button.tsx', {}, { feContext: 'storybook: false\n' }).stdout, '');
  });

  it('survives unparseable stdin', () => {
    assert.equal(runHook('check-story-exists.mjs', 'not-json{', { raw: true }).stdout, '');
  });

  it('survives empty stdin', () => {
    assert.equal(runHook('check-story-exists.mjs', '', { raw: true }).stdout, '');
  });

  it('stays silent for non-mutating tools — safe even when the matcher widens', () => {
    const project = makeProject({ '.omj/fe-context.md': 'storybook: true\n', 'src/Button.tsx': COMPONENT });
    projects.push(project);
    const payload = postToolUsePayload({
      cwd: project.root,
      filePath: project.file('src/Button.tsx'),
      toolName: 'Read',
    });
    assert.equal(runHook('check-story-exists.mjs', payload).stdout, '');
  });

  it('never reads absolute-path files outside the project — same containment rule as the sibling hook', () => {
    const project = makeProject({ '.omj/fe-context.md': 'storybook: true\n' });
    projects.push(project);
    const outsider = makeProject({ 'Secret.tsx': COMPONENT });
    projects.push(outsider);

    const payload = postToolUsePayload({ cwd: project.root, filePath: outsider.file('Secret.tsx') });
    assert.equal(runHook('check-story-exists.mjs', payload).stdout, '');
  });
});

describe('check-story-exists — detection', () => {
  it('warns on a component without a Story', () => {
    const result = checkFile('src/Button.tsx');
    assert.match(result.context, /no Button\.stories\.\* found/);
  });

  it('stays quiet when a Story exists in the same directory', () => {
    const result = checkFile('src/Button.tsx', { 'src/Button.stories.tsx': 'export default {};\n' });
    assert.equal(result.stdout, '');
  });

  it('accepts Stories with a different extension', () => {
    const result = checkFile('src/Button.tsx', { 'src/Button.stories.mdx': '# Button\n' });
    assert.equal(result.stdout, '');
  });
});

describe('check-story-exists — exclusions', () => {
  const excluded = {
    'src/Button.stories.tsx': 'the Story file itself',
    'src/Button.test.tsx': 'a test file',
    'src/Button.spec.tsx': 'a spec file',
  };

  for (const [file, label] of Object.entries(excluded)) {
    it(`does not check ${label}`, () => {
      assert.equal(checkFile(file).stdout, '');
    });
  }

  it('does not check non-component extensions', () => {
    assert.equal(checkFile('src/util.ts').stdout, '');
  });
});

describe('check-story-exists — Next.js App Router reserved files', () => {
  // Routing entry points are not Story targets. Without this filter, the hook fires constantly in App Router projects.
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
    it(`does not check app/dashboard/${file}`, () => {
      assert.equal(checkFile(`app/dashboard/${file}`).stdout, '');
    });
  }
});

describe('check-story-exists — component identification', () => {
  it('accepts a directory-named Story in the barrel pattern', () => {
    const result = checkFile('src/components/Button/index.tsx', {
      'src/components/Button/Button.stories.tsx': 'export default {};\n',
    });
    assert.equal(result.stdout, '');
  });

  it('warns with the directory name when the barrel pattern lacks a Story', () => {
    const result = checkFile('src/components/Button/index.tsx');
    assert.match(result.context, /no Button\.stories\.\* found/);
  });

  it('treats lowercase-first files as hooks/utils by convention and skips them', () => {
    assert.equal(checkFile('src/useModal.tsx').stdout, '');
    assert.equal(checkFile('src/formatDate.tsx').stdout, '');
  });
});

describe('check-story-exists — storiesDir declaration', () => {
  it('supports projects collecting Stories in a separate directory', () => {
    const result = checkFile(
      'src/Button.tsx',
      { 'stories/Button.stories.tsx': 'export default {};\n' },
      { feContext: 'storybook: true\nstoriesDir: stories\n' },
    );
    assert.equal(result.stdout, '');
  });

  it('warns when the declared directory lacks the Story too', () => {
    const result = checkFile(
      'src/Button.tsx',
      { 'stories/Other.stories.tsx': 'export default {};\n' },
      { feContext: 'storybook: true\nstoriesDir: stories\n' },
    );
    assert.match(result.context, /no Button\.stories\.\* found/);
  });

  // A one-letter typo must not mute the hook across the whole project —
  // an unreadable directory can never be evidence of "Story exists".
  it('a broken storiesDir declaration never swallows the sibling-directory verdict', () => {
    const result = checkFile(
      'src/Button.tsx',
      {},
      { feContext: 'storybook: true\nstoriesDir: stroies\n' },
    );
    assert.match(result.context, /no Button\.stories\.\* found/);
  });

  it('stays silent when none of the search directories are readable', () => {
    const project = makeProject({ '.omj/fe-context.md': 'storybook: true\n' });
    projects.push(project);
    // The file does not exist, so its sibling directory is unreadable too → no evidence → silence
    const payload = postToolUsePayload({
      cwd: project.root,
      filePath: project.file('missing/deeply/Button.tsx'),
    });
    assert.equal(runHook('check-story-exists.mjs', payload).stdout, '');
  });
});
