import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile, parseFrontmatter } from './helpers/repo.mjs';

describe('portable planning and goal workflow', () => {
  it('both hosts expose the canonical plan and execution entry points', () => {
    for (const name of ['ralplan', 'ultragoal']) {
      const command = readRepoFile('commands', `${name}.md`);
      const skill = readRepoFile('skills', name, 'SKILL.md');
      assert.equal(parseFrontmatter(skill).name, name);
      assert.ok(command.length > 100);
      assert.match(skill, new RegExp(`commands/${name}\\.md`));
    }
  });

  it('spec is a read-only compatibility bridge, not a second plan author', () => {
    for (const file of ['commands/spec.md', 'skills/spec/SKILL.md']) {
      const source = readRepoFile(file);
      assert.match(source, /ralplan/);
      assert.match(source, /compatib|alias/i);
      assert.doesNotMatch(source, /## Phase [123]/);
    }
    const tools = parseFrontmatter(readRepoFile('commands/spec.md'))['allowed-tools'];
    assert.doesNotMatch(tools, /\b(?:Write|Edit|Bash|Agent)\b/);
  });

  it('Figma token sync keeps its original purpose', () => {
    for (const file of ['commands/sync.md', 'skills/sync/SKILL.md']) {
      assert.match(readRepoFile(file), /Figma/);
      assert.match(readRepoFile(file), /alias/);
    }
  });

  it('read-only PR planning does not pre-approve a generic GitHub write path', () => {
    const tools = parseFrontmatter(readRepoFile('commands/ralplan.md'))['allowed-tools'];
    assert.doesNotMatch(tools, /\b(?:Write|Edit)\b/);
    assert.doesNotMatch(tools, /Bash\(gh api:\*\)/);
    assert.doesNotMatch(tools, /Bash\(git (?:push|commit)/);
  });

  it('execution does not pre-approve arbitrary checks through its state helper', () => {
    const tools = parseFrontmatter(readRepoFile('commands/ultragoal.md'))['allowed-tools'];
    assert.doesNotMatch(tools, /Bash\(node [^)]*goal-state\.mjs:\*\)/);
    assert.doesNotMatch(tools, /Bash\((?:npm|pnpm|yarn|node):\*\)/);
  });
});
