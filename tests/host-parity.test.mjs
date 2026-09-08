import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { parseFrontmatter, readRepoFile, repoPath } from './helpers/repo.mjs';

describe('Claude/Codex capability parity', () => {
  it('every repo-local Claude command and skill has one discoverable Codex counterpart', () => {
    const commands = readdirSync(repoPath('.claude/commands')).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3));
    const skills = readdirSync(repoPath('.claude/skills')).filter(name => existsSync(repoPath('.claude/skills', name, 'SKILL.md')));
    const expected = [...new Set([...commands, ...skills])].sort();
    const actual = readdirSync(repoPath('.agents/skills')).sort();
    assert.deepEqual(actual, expected);
    for (const name of expected) {
      const source = readRepoFile('.agents/skills', name, 'SKILL.md');
      assert.equal(parseFrontmatter(source).name, name);
      assert.match(source, /docs\/RELEASING\.md/);
      assert.doesNotMatch(source, /\b(?:AskUserQuestion|ExitPlanMode|CLAUDE_PLUGIN_ROOT)\b/);
      assert.equal(existsSync(repoPath('.codex/skills', name, 'SKILL.md')), false, 'no duplicate compatibility discovery root');
      assert.equal(existsSync(repoPath('skills', name, 'SKILL.md')), false, 'maintainer commands must not become consuming-project workflows');
    }
  });

  it('all public workflow and internal role adapters reference their maintained source', () => {
    for (const file of readdirSync(repoPath('commands')).filter(f => f.endsWith('.md'))) {
      const name = file.slice(0, -3);
      const source = readRepoFile('skills', name, 'SKILL.md');
      const contract = name === 'setup' ? 'docs/CODEX-SETUP.md'
        : name === 'spec' ? 'commands/ralplan.md' : `commands/${file}`;
      assert.ok(source.includes(contract), name);
    }
    for (const file of readdirSync(repoPath('agents')).filter(f => f.endsWith('.md'))) {
      assert.ok(readRepoFile('skills', file.slice(0, -3), 'SKILL.md').includes(`agents/${file}`), file);
    }
  });

  it('Codex project instructions bridge to the existing shared repository contract', () => {
    assert.match(readRepoFile('AGENTS.md'), /\[CLAUDE\.md\]\(CLAUDE\.md\)/);
    assert.match(readRepoFile('AGENTS.md'), /\.agents\/skills/);
  });

  it('the packaged project hook matcher covers actual Codex writes without auto-firing', () => {
    const template = JSON.parse(readRepoFile('templates/codex/hooks.json'));
    const groups = template.hooks.PostToolUse;
    assert.equal(groups.length, 1);
    const matcher = new RegExp(groups[0].matcher);
    assert.ok(matcher.test('apply_patch'));
    assert.ok(matcher.test('Bash'));
    assert.equal(matcher.test('Read'), false);
    assert.match(groups[0].hooks[0].command, /git rev-parse --show-toplevel/);
    assert.match(groups[0].hooks[0].commandWindows, /powershell.*Join-Path.*git rev-parse --show-toplevel/);
    for (const script of ['codex-post-tool-use.mjs', 'check-design-tokens.mjs', 'check-story-exists.mjs']) {
      assert.ok(existsSync(repoPath('templates/hooks', script)), script);
    }
    assert.equal(existsSync(repoPath('hooks/hooks.json')), false);
    assert.equal(existsSync(repoPath('.codex/hooks.json')), false);
  });

  it('setup preserves opt-in choices and declares executable style/footer mappings', () => {
    const setup = readRepoFile('docs/CODEX-SETUP.md');
    assert.match(setup, /--check.*never asks.*mutates/);
    assert.match(setup, /output-styles\/oh-my-joy\.md/);
    assert.match(setup, /AGENTS\.override\.md/);
    assert.match(setup, /OMJ:ANSWER-STYLE:START/);
    assert.match(setup, /\[tui\][\s\S]*status_line/);
    assert.match(setup, /Codex App has no documented custom TUI footer/);
  });
});
