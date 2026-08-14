/**
 * Contract tests for check-design-tokens.mjs.
 *
 * The hook's design contract is threefold:
 *   ① in projects without an fe-context declaration, **always no-op** (PRINCIPLES ⑩ — universality)
 *   ② checks only, never blocks (always exit 0)
 *   ③ the token definition file itself legitimately holds raw values — excluded
 * The tests below pin that contract, and that false positives do not disrupt real development flow.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

import { runHook, makeProject, postToolUsePayload } from '../helpers/repo.mjs';

const FE_CONTEXT = 'tokensPath: src/tokens/colors.css\n';
const projects = [];

/** The hook output when a target file is saved in a consuming project with fe-context declared. */
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

describe('check-design-tokens — gate (universality guarantee)', () => {
  it('no-op without fe-context.md — no noise for projects that did not declare', () => {
    const result = checkFile('src/Button.tsx', 'const s = { color: "#ff0000" };\n', { feContext: null });
    assert.equal(result.stdout, '');
  });

  it('no-op even when fe-context.md is unreadable (a directory) — a check hook never blocks the session (fail-open)', () => {
    // The case where existsSync passes but readFileSync fails with EISDIR —
    // without try/catch the uncaught exception leaks as exit 1, breaking the fail-open contract.
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

  it('no-op when fe-context exists but tokensPath is undeclared', () => {
    const result = checkFile('src/Button.tsx', 'const s = { color: "#ff0000" };\n', {
      feContext: 'storybook: true\n',
    });
    assert.equal(result.stdout, '');
  });

  it('survives unparseable stdin', () => {
    assert.equal(runHook('check-design-tokens.mjs', 'not-json{', { raw: true }).stdout, '');
  });

  it('survives empty stdin', () => {
    assert.equal(runHook('check-design-tokens.mjs', '', { raw: true }).stdout, '');
  });

  it('survives stdin that is JSON but not an object', () => {
    assert.equal(runHook('check-design-tokens.mjs', 'not-json').stdout, '');
  });
});

describe('check-design-tokens — detection', () => {
  it('warns on hardcoded hex', () => {
    const result = checkFile('src/Button.tsx', 'export const s = { background: "#ff0000" };\n');
    assert.match(result.context, /detected 1 hardcoded color\(s\)/);
    assert.match(result.context, /src\/tokens\/colors\.css/);
  });

  it('warns on rgba() too', () => {
    const result = checkFile('src/Card.css', '.card { box-shadow: 0 0 4px rgba(0, 0, 0, 0.2); }\n');
    assert.match(result.context, /detected 1 hardcoded color\(s\)/);
  });

  it('stays quiet when only semantic tokens are used', () => {
    const result = checkFile(
      'src/Button.tsx',
      'export const Button = () => <button className="bg-surface-primary text-fg-default" />;\n',
    );
    assert.equal(result.stdout, '');
  });

  it('var() references are not violations', () => {
    const result = checkFile('src/Card.css', '.card { color: var(--color-fg-default); }\n');
    assert.equal(result.stdout, '');
  });

  it('excludes the token definition file itself from checking', () => {
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

  it('lists at most 5 lines and folds the rest into a count', () => {
    const source = Array.from({ length: 8 }, (_, i) => `  --c${i}: #ff00${i}${i};`).join('\n');
    const result = checkFile('src/palette.css', `:root {\n${source}\n}\n`);
    assert.match(result.context, /detected 8 hardcoded color\(s\) \(across 8 lines\)/);
    assert.match(result.context, /… and 3 more line\(s\)/);
  });

  it('counts colors, not lines, when one line holds several colors', () => {
    const result = checkFile('src/theme.css', '.a { color: #ff0000; background: #00ff00; border-color: #0000ff; }\n');
    assert.match(result.context, /detected 3 hardcoded color\(s\)/);
    assert.doesNotMatch(result.context, /across \d+ lines/); // no line count is appended for a single line
  });
});

describe('check-design-tokens — false-positive prevention', () => {
  it('does not mistake SVG url(#id) references for colors', () => {
    const result = checkFile('src/Icon.tsx', 'export const Icon = () => <rect fill="url(#grad1)" />;\n');
    assert.equal(result.stdout, '');
  });

  it('does not mistake anchor links / DOM id selectors for colors', () => {
    const result = checkFile(
      'src/Nav.tsx',
      'export const Nav = () => <a href="/docs#faq">FAQ</a>;\nconst el = document.querySelector("#app-root");\n',
    );
    assert.equal(result.stdout, '');
  });

  it('hashes longer than color length (commit SHAs etc.) are not colors', () => {
    const result = checkFile('src/meta.tsx', 'export const commit = "#1234567890abcdef";\n');
    assert.equal(result.stdout, '');
  });

  it('does not warn on old colors inside comments — line-leading comment', () => {
    const result = checkFile('src/Button.tsx', '// legacy palette: #ff0000\nexport const Button = () => null;\n');
    assert.equal(result.stdout, '');
  });

  it('does not warn on old colors inside comments — inline comment after code', () => {
    const result = checkFile(
      'src/Button.tsx',
      'export const Button = () => null; // legacy palette was #ff0000\n',
    );
    assert.equal(result.stdout, '');
  });

  it('does not warn on colors inside block comments', () => {
    const result = checkFile('src/Button.tsx', '/*\n  before: #ff0000\n*/\nexport const Button = () => null;\n');
    assert.equal(result.stdout, '');
  });
});

describe('check-design-tokens — target extensions', () => {
  const violation = 'export const theme = { bg: "#ff0000" };\n';

  for (const file of ['src/Button.tsx', 'src/Button.jsx', 'src/button.css']) {
    it(`checks ${file}`, () => {
      assert.match(checkFile(file, violation).context, /hardcoded color/);
    });
  }

  // styled-components, theme objects, and CSS-in-TS commonly live in .ts/.scss.
  for (const file of ['src/theme.ts', 'src/button.scss']) {
    it(`checks ${file} too`, () => {
      assert.match(checkFile(file, violation).context, /hardcoded color/);
    });
  }

  it('skips extensions outside the target set', () => {
    assert.equal(checkFile('README.md', 'the color is #ff0000.\n').stdout, '');
  });
});

describe('check-design-tokens — modern CSS color syntax', () => {
  // The Tailwind v4 / shadcn ecosystem uses hsl()/oklch() as its primary color syntax.
  const modern = {
    'hsl()': '--background: hsl(0 0% 100%);',
    'oklch()': '--brand: oklch(0.63 0.19 250);',
    'hwb()': 'color: hwb(194 0% 0%);',
    'lab()': 'color: lab(52% 40 60);',
  };

  for (const [label, declaration] of Object.entries(modern)) {
    it(`detects ${label}`, () => {
      assert.match(checkFile('src/theme.css', `:root { ${declaration} }\n`).context, /detected 1 hardcoded color\(s\)/);
    });
  }

  it('color functions wrapping var() are token usage, not violations', () => {
    const result = checkFile('src/theme.css', '.a { color: hsl(var(--h) var(--s) var(--l)); }\n');
    assert.equal(result.stdout, '');
  });

  it('var() arguments of multiline color functions are not violations either', () => {
    const source = '.a {\n  color: hsl(\n    var(--h) var(--s) var(--l)\n  );\n}\n';
    assert.equal(checkFile('src/theme.css', source).stdout, '');
  });

  it('color-library method calls are not color literals', () => {
    const source = 'export const c = chroma.lab(50, 0, 0);\nexport const d = (x) => d3.rgb(x).darker();\n';
    assert.equal(checkFile('src/color.ts', source).stdout, '');
  });

  it('detects named colors in CSS declaration positions', () => {
    assert.match(checkFile('src/a.css', '.a { border: 1px solid black; }\n').context, /detected 1 hardcoded color\(s\)/);
  });

  it('detects named colors in background-image too', () => {
    const result = checkFile('src/a.css', '.a { background-image: linear-gradient(red, blue); }\n');
    assert.match(result.context, /hardcoded color/);
  });

  it('token references carrying color names are not violations — they are the usage the hook recommends', () => {
    const source = ':root { --brand: var(--color-red-500); }\n.a { background: var(--gray-100); }\n';
    assert.equal(checkFile('src/theme.css', source).stdout, '');
  });

  it('token notation carrying a color name (red.500) is not a violation', () => {
    assert.equal(checkFile('src/theme.ts', 'export const s = { color: "red.500" };\n').stdout, '');
  });

  it('with several properties on one line, an earlier property never swallows a later value', () => {
    const source = 'export type P = { color: string, tone: "red" | "blue" };\n';
    assert.equal(checkFile('src/types.ts', source).stdout, '');
  });

  it('free-position color names are indistinguishable from identifiers and are not checked', () => {
    const source = 'const red = 1;\nexport const cls = "text-red-500 bg-black";\n';
    assert.equal(checkFile('src/Badge.tsx', source).stdout, '');
  });
});

describe('check-design-tokens — suppression and containment', () => {
  it('does not warn on lines carrying an omj-allow-color comment', () => {
    const source = '.brand { color: #ff0000; } /* omj-allow-color: fixed external SDK color */\n';
    assert.equal(checkFile('src/vendor.css', source).stdout, '');
  });

  it('never reads absolute-path files outside the project', () => {
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

  it('stays silent for non-mutating tools — safe even when the matcher widens', () => {
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
