import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { makeProject, repoPath } from '../helpers/repo.mjs';

function fixture(extra = {}) {
  const project = makeProject({
    '.omj/fe-context.md': 'tokensPath: src/tokens/colors.css\nstorybook: true\n',
    'src/tokens/colors.css': ':root { --primary: #fff; }',
    'src/Button.tsx': 'export const Button = () => <button style={{ color: "#f00" }}>OK</button>;\n',
    ...extra,
  });
  const hooks = path.join(project.root, '.codex/hooks');
  mkdirSync(hooks, { recursive: true });
  for (const name of ['codex-post-tool-use.mjs', 'check-design-tokens.mjs', 'check-story-exists.mjs']) {
    cpSync(repoPath('templates/hooks', name), path.join(hooks, name));
  }
  return { ...project, adapter: path.join(hooks, 'codex-post-tool-use.mjs') };
}

function run(project, command, { tool = 'apply_patch', cwd = project.root, raw, event = 'PostToolUse' } = {}) {
  const output = execFileSync(process.execPath, [project.adapter], {
    cwd,
    input: raw ?? JSON.stringify({ hook_event_name: event, tool_name: tool, cwd, tool_input: { command }, tool_response: {} }),
    encoding: 'utf8',
  });
  return output.trim() ? JSON.parse(output) : null;
}

describe('Codex frontend advisory hook', () => {
  it('the installed copy maps canonical apply_patch command input to both existing checks', () => {
    const p = fixture();
    try {
      const result = run(p, '*** Begin Patch\n*** Update File: src/Button.tsx\n@@\n-old\n+new\n*** End Patch');
      assert.match(result.systemMessage, /hardcoded color/);
      assert.match(result.systemMessage, /no Button\.stories/);
      assert.equal(result.hookSpecificOutput.additionalContext, result.systemMessage);
      assert.equal(result.hookSpecificOutput.hookEventName, 'PostToolUse');
      assert.equal(result.decision, undefined);
    } finally { p.cleanup(); }
  });

  it('resolves multiple additions and renamed targets from a nested working directory', () => {
    const p = fixture({ 'src/New Button.tsx': 'export const Button = () => <div />;', 'src/Other.jsx': 'export const Other = () => <div />;' });
    try {
      const result = run(p, '*** Begin Patch\n*** Update File: Old.tsx\n*** Move to: New Button.tsx\n@@\n-a\n+b\n*** Add File: Other.jsx\n+x\n*** End Patch', { cwd: path.join(p.root, 'src') });
      assert.match(result.systemMessage, /New Button/);
      assert.match(result.systemMessage, /Other/);
      assert.doesNotMatch(result.systemMessage, /Old\.tsx/);
    } finally { p.cleanup(); }
  });

  it('handles an exact apply_patch heredoc in Bash without executing the command', () => {
    const p = fixture();
    try {
      const command = "apply_patch <<'PATCH'\n*** Begin Patch\n*** Update File: src/Button.tsx\n@@\n-x\n+y\n*** End Patch\nPATCH";
      assert.match(run(p, command, { tool: 'Bash' }).systemMessage, /hardcoded color/);
      assert.equal(run(p, `${command}\nprintf injected`, { tool: 'Bash' }), null);
      assert.equal(run(p, 'printf "#f00" > src/Button.tsx', { tool: 'Bash' }), null);
    } finally { p.cleanup(); }
  });

  it('keeps both checks active more than ten directories below the project root', () => {
    const p = fixture();
    try {
      const cwd = path.join(p.root, ...Array(12).fill('nested'));
      mkdirSync(cwd, { recursive: true });
      const target = path.relative(cwd, p.file('src/Button.tsx'));
      const result = run(p, `*** Begin Patch\n*** Update File: ${target}\n@@\n-x\n+y\n*** End Patch`, { cwd });
      assert.match(result.systemMessage, /hardcoded color/);
      assert.match(result.systemMessage, /no Button\.stories/);
    } finally { p.cleanup(); }
  });

  it('does not warn on deletes, undeclared checks, malformed input, or unrelated tools/events', () => {
    const p = fixture({ '.omj/fe-context.md': '' });
    try {
      const patch = '*** Begin Patch\n*** Update File: src/Button.tsx\n@@\n-x\n+y\n*** End Patch';
      assert.equal(run(p, patch), null);
      assert.equal(run(p, '*** Begin Patch\n*** Delete File: src/Button.tsx\n*** End Patch'), null);
      assert.equal(run(p, patch, { tool: 'Read' }), null);
      assert.equal(run(p, patch, { event: 'PreToolUse' }), null);
      assert.equal(run(p, patch, { raw: 'not json' }), null);
      assert.equal(run(p, '*** Begin Patch\n*** Update File: src/Button.tsx'), null);
    } finally { p.cleanup(); }
  });

  it('does not inspect paths or symlinks escaping the declared project', () => {
    const outside = makeProject({ 'Secret.tsx': 'const secret = "#fff";' });
    const p = fixture();
    try {
      symlinkSync(outside.file('Secret.tsx'), p.file('src/Link.tsx'));
      const patch = `*** Begin Patch\n*** Update File: ${outside.file('Secret.tsx')}\n@@\n-x\n+y\n*** Update File: src/Link.tsx\n@@\n-x\n+y\n*** End Patch`;
      assert.equal(run(p, patch), null);
    } finally { p.cleanup(); outside.cleanup(); }
  });
});
