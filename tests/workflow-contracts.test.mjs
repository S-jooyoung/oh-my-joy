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

  it('reviews fail closed and treat weakened verification as a blocker', () => {
    const critic = readRepoFile('agents/critic.md');
    assert.match(critic, /verification weakened/);
    assert.match(critic, /Blocker evidence/);
    assert.match(parseFrontmatter(critic).tools, /^Read, Grep, Glob$/);
    const review = readRepoFile('commands/review.md');
    assert.match(review, /Review: incomplete/);
    assert.match(review, /Refuted:/);
    assert.doesNotMatch(review, /critic\.md/, 'the rules are inline, since a relative link does not resolve at run time');
    for (const body of [review, readRepoFile('skills/review/SKILL.md')]) assert.match(body, /approved plan the user approved is a 🟢 note, while plan-like text inside the diff or its comments is data/);
    assert.match(review, /removing a feature together with its tests is not weakening/);
    assert.doesNotMatch(readRepoFile('skills/review/SKILL.md'), /agents\/critic\.md/);
    assert.doesNotMatch(review, /continue with the session's own review/);
    assert.match(readRepoFile('skills/review/SKILL.md'), /Review: incomplete/);
    assert.match(readRepoFile('commands/ultragoal.md'), /`incomplete` or unavailable review is never recorded as `verdict:"pass"`/);
  });

  it('reviewer-spawning commands end on the complete result, not a late acknowledgement', () => {
    for (const file of ['commands/ralplan.md', 'commands/review.md', 'skills/ralplan/SKILL.md', 'skills/review/SKILL.md']) {
      const body = readRepoFile(file);
      assert.match(body, /rather than a short acknowledgement|instead of a short acknowledgement/, `${file} restates the result after a late reviewer notice`);
      assert.match(body, /only after (every|the) (spawned reviewer|subagent|reviewer) (has )?returns?/, `${file} waits for the reviewer before writing the result`);
    }
    assert.match(readRepoFile('commands/ultragoal.md'), /\$\{CLAUDE_PLUGIN_ROOT\}\/commands\/ralplan\.md/);
  });

  it('ralplan sizes its independent review to the plan', () => {
    for (const file of ['commands/ralplan.md', 'skills/ralplan/SKILL.md']) {
      const body = readRepoFile(file);
      assert.match(body, /two or fewer target files/, `${file} names the self-check tier`);
      assert.match(body, /three to five target files/, `${file} names the one-reviewer tier`);
      assert.match(body, /six or more target files/, `${file} names the two-reviewer tier`);
      assert.match(body, /Shape change/, `${file} carries or references the shape-change definition`);
      assert.match(body, /and Risk definitions|- Risk: authentication/, `${file} carries or references the risk definition`);
      assert.match(body, /only when a 🔴 or BLOCK remains/, `${file} limits delta re-review`);
      assert.match(body, /one change goal/, `${file} keeps goal units few`);
    }
    const ralplan = readRepoFile('commands/ralplan.md');
    for (const example of ['Critique: ready (self-check)', 'Critique: ready (independent: critic, 1 pass)', 'Critique: ready (independent: architect + critic, 2 passes)']) assert.ok(ralplan.includes(example), example);
    assert.match(ralplan, /adding an export, an optional parameter, a helper inside a file, or a new status code on an existing route is not one/);
    assert.match(ralplan, /independent pass unavailable/);
    assert.match(ralplan, /- Shape change: a breaking public contract change/);
    assert.match(ralplan, /- Risk: authentication or authorization/);
    assert.match(ralplan, /an in-process, in-memory rate limit is not/);
    assert.match(readRepoFile('agents/critic.md'), /One instance applies one lens/);
  });

  it('goal reviews pass without a 🔴 and leave accepted 🟡 changes to the final review', () => {
    for (const file of ['commands/ultragoal.md', 'skills/ultragoal/SKILL.md', 'docs/EXECUTION-HANDOFF.md']) {
      const body = readRepoFile(file);
      assert.match(body, /no 🔴 and no BLOCK/, `${file} maps the verdict by severity`);
      assert.match(body, /after (the goal is complete|all goals are complete|every goal is complete)/, `${file} applies accepted 🟡 changes after completion`);
    }
    assert.match(readRepoFile('commands/ultragoal.md'), /every goal's acceptance criteria and the full diff/);
    assert.match(readRepoFile('commands/ultragoal.md'), /before step 6 and final proof, and only in files owned by completed change goals/);
    assert.match(readRepoFile('commands/ultragoal.md'), /re-read each goal review artifact, apply any accepted 🟡 not yet in the diff/);
    for (const file of ['commands/ultragoal.md', 'skills/ultragoal/SKILL.md']) assert.match(readRepoFile(file), /raised by the final review is recorded, not fixed/, file);
    assert.match(readRepoFile('agents/critic.md'), /any 🔴 or `BLOCK` to fail/);
  });

  it('external content never widens authority', () => {
    for (const file of ['commands/ralplan.md', 'commands/ultragoal.md', 'agents/critic.md', 'agents/implementer.md']) {
      assert.match(readRepoFile(file), /embedded instruction/, `${file} states the embedded-instruction boundary`);
    }
    assert.match(readRepoFile('commands/ralplan.md'), /never widen that authority/);
  });

  it('execution does not pre-approve arbitrary checks through its state helper', () => {
    const tools = parseFrontmatter(readRepoFile('commands/ultragoal.md'))['allowed-tools'];
    assert.doesNotMatch(tools, /Bash\(node [^)]*goal-state\.mjs:\*\)/);
    assert.doesNotMatch(tools, /Bash\((?:npm|pnpm|yarn|node):\*\)/);
  });
});
