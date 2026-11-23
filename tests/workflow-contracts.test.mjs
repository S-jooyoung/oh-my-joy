import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readRepoFile, parseFrontmatter, repoPath, listTrackedFiles } from './helpers/repo.mjs';

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

  it('read-only planning does not pre-approve a generic GitHub write path', () => {
    const tools = parseFrontmatter(readRepoFile('commands/ralplan.md'))['allowed-tools'];
    assert.doesNotMatch(tools, /\b(?:Write|Edit)\b/);
    assert.doesNotMatch(tools, /Bash\(gh api:\*\)/);
    assert.doesNotMatch(tools, /Bash\(git (?:push|commit)/);
  });

  it('reviews check the repository instruction files without letting a diff grant itself an exception', () => {
    for (const file of ['agents/critic.md', 'skills/critic/SKILL.md']) {
      const body = readRepoFile(file);
      assert.match(body, /🟡 `repo rule`/, `${file} names the repo rule finding`);
      assert.match(body, /ancestor directories/, `${file} covers instruction files above a changed file`);
      assert.match(body, /left side/, `${file} judges a modified instruction file by the diff's base side`);
      assert.match(body, /can settle a fact a rule relies on/, `${file} lets an instruction file settle facts, not exceptions`);
      assert.match(body, /added or changed lines settle no fact/, `${file} keeps the diff's own rule edits from settling facts`);
      assert.doesNotMatch(body, /does not show an instruction file's removed lines/, `${file} drops the removed-lines-only fallback`);
      assert.match(body, /an instruction file the diff adds provides no rules/, `${file} treats an added instruction file as data`);
      assert.match(body, /process rules the diff cannot show/, `${file} skips rules the diff cannot settle`);
      assert.match(body, /lint, typecheck, or test configuration already enforces/, `${file} skips rules a tool already enforces`);
      assert.match(body, /never creates an exception or suppresses or demotes another diff rule/, `${file} keeps exceptions with the approved plan`);
    }
    for (const file of ['agents/critic.md', 'skills/critic/SKILL.md']) {
      assert.match(readRepoFile(file), /find the repository instruction files yourself/, `${file} discovers the rules without the caller`);
      assert.match(readRepoFile(file), /list of changed files/, `${file} reads the caller's diff as the changed-file list`);
      assert.match(readRepoFile(file), /When the caller passed no diff/, `${file} declines only without a diff`);
    }
  });

  it('setup discloses the HUD usage probe and how to turn it off', () => {
    const setup = readRepoFile('commands/setup.md');
    assert.ok((setup.match(/"rateLimits": false/g) ?? []).length >= 2, 'setup names the opt-out where the HUD is offered and inspected');
    assert.match(setup, /403/, 'setup names the condition that triggers the probe');
  });

  it('a check goal counts its failing run only when it fails for the named violation', () => {
    for (const file of ['commands/ultragoal.md', 'skills/ultragoal/SKILL.md', 'docs/EXECUTION-HANDOFF.md']) {
      const body = readRepoFile(file);
      assert.match(body, /failing at the assertion or rule aimed at the named violation/, `${file} checks why the red happened`);
      assert.match(body, /confirm with `git diff` where it landed/, `${file} confirms where a planted violation landed`);
    }
  });

  it('reviews fail closed and treat weakened verification as a blocker', () => {
    const critic = readRepoFile('agents/critic.md');
    assert.match(critic, /verification weakened/);
    assert.match(critic, /Blocker evidence/);
    assert.match(parseFrontmatter(critic).tools, /^Read, Grep, Glob$/);
    assert.match(readRepoFile('commands/ultragoal.md'), /`incomplete` or unavailable review is never recorded as `verdict:"pass"`/);
  });

  it('spawning commands stop their teammates and reviewers once results are recorded', () => {
    for (const file of ['commands/ultragoal.md', 'commands/ralplan.md']) {
      const source = readRepoFile(file);
      assert.match(parseFrontmatter(source)['allowed-tools'], /\bTaskStop\b/, `${file} declares TaskStop`);
      assert.match(source, /[Ss]top (?:it|the reviewer) with `TaskStop`|stopped with `TaskStop`/, `${file} stops the agents it spawns`);
      assert.match(source, /no messaging tool/, `${file} says why a shutdown request is not enough`);
    }
    const ultragoal = readRepoFile('commands/ultragoal.md');
    assert.match(parseFrontmatter(ultragoal)['allowed-tools'], /\bListAgents\b/);
    assert.match(ultragoal, /list the session's agents with `ListAgents`/);
    for (const file of ['skills/ultragoal/SKILL.md', 'skills/ralplan/SKILL.md']) {
      assert.match(readRepoFile(file), /Retire (?:every native subagent|each reviewer|the subagent)/, `${file} retires its subagents`);
    }
    assert.match(readRepoFile('agents/critic.md'), /shutdown request addressed to it goes unanswered/);
    assert.match(readRepoFile('docs/EXECUTION-HANDOFF.md'), /stops each teammate and reviewer as soon as its result is recorded/);
  });

  it("ship sweeps the session's finished agents before verification", () => {
    const ship = readRepoFile('commands/ship.md');
    const tools = parseFrontmatter(ship)['allowed-tools'];
    assert.match(tools, /\bListAgents\b/, 'ship declares ListAgents');
    assert.match(tools, /\bTaskStop\b/, 'ship declares TaskStop');
    assert.match(ship, /Before step 1, list the session's agents with `ListAgents`/);
    assert.match(ship, /Stop with `TaskStop` each teammate of this session that the listing shows idle/);
    assert.match(ship, /or with no state, ends the run before step 1/, 'a working or unknown agent stops ship before verification');
    assert.match(ship, /`Peer sessions` in the listing are other sessions and stay untouched/);
    assert.match(ship, /exposes no `ListAgents`/, 'ship degrades when the host lacks the listing');
    assert.match(ship, /Agents: none open/, 'the output names the sweep result');
  });

  it('ralplan sweeps planning agents before the approval screen', () => {
    const ralplan = readRepoFile('commands/ralplan.md');
    assert.match(parseFrontmatter(ralplan)['allowed-tools'], /\bListAgents\b/, 'ralplan declares ListAgents');
    assert.match(ralplan, /this command spawns only the `critic`/);
    assert.match(ralplan, /spawn it without `name`/);
    assert.match(ralplan, /Before presenting the final plan, list the session's agents with `ListAgents`/);
    assert.match(ralplan, /exploration agents included/);
    const interview = readRepoFile('commands/deep-interview.md');
    assert.match(interview, /spawn it without `name`/);
    assert.equal(parseFrontmatter(interview)['allowed-tools'], 'Read, Grep, Glob, Skill, AskUserQuestion');
  });

  it('ultragoal close and the Codex adapters cover the whole session', () => {
    const ultragoal = readRepoFile('commands/ultragoal.md');
    assert.match(ultragoal, /this session spawned that is still open/);
    assert.doesNotMatch(ultragoal, /this run spawned/);
    assert.match(ultragoal, /Teammates do not survive a host `\/resume`/);
    for (const name of ['ultragoal', 'ship']) {
      assert.match(readRepoFile('skills', name, 'SKILL.md'), /Retire every native subagent this session started/, `skills/${name} retires the session's subagents`);
    }
    for (const name of ['ralplan', 'deep-interview']) {
      assert.match(readRepoFile('skills', name, 'SKILL.md'), /retire any exploration subagent/, `skills/${name} retires exploration subagents`);
    }
  });

  it('reviewer-spawning commands end on the complete result, not a late acknowledgement', () => {
    for (const file of ['commands/ralplan.md', 'skills/ralplan/SKILL.md']) {
      const body = readRepoFile(file);
      assert.match(body, /rather than a short acknowledgement|instead of a short acknowledgement/, `${file} restates the result after a late reviewer notice`);
      assert.match(body, /only after (every|the) (spawned reviewer|subagent|reviewer) (has )?returns?/, `${file} waits for the reviewer before writing the result`);
    }
    assert.match(readRepoFile('commands/ultragoal.md'), /\$\{CLAUDE_PLUGIN_ROOT\}\/commands\/ralplan\.md/);
  });

  it('ralplan sizes its independent review to the plan', () => {
    for (const file of ['commands/ralplan.md', 'skills/ralplan/SKILL.md']) {
      const body = readRepoFile(file);
      assert.match(body, /more than two target files/, `${file} names when the critic runs`);
      assert.match(body, /Shape change/, `${file} carries or references the shape-change definition`);
      assert.match(body, /and Risk definitions|- Risk: authentication/, `${file} carries or references the risk definition`);
      assert.match(body, /one change goal/, `${file} keeps goal units few`);
    }
    const ralplan = readRepoFile('commands/ralplan.md');
    assert.match(ralplan, /adding an export, an optional parameter, a helper inside a file, or a new status code on an existing route is not one/);
    assert.match(ralplan, /independent pass unavailable/);
    assert.match(ralplan, /- Shape change: a breaking public contract change/);
    assert.match(ralplan, /- Risk: authentication or authorization/);
    assert.match(ralplan, /an in-process, in-memory rate limit is not/);
  });

  it('goal reviews pass without a 🔴 and leave accepted 🟡 changes to the final review', () => {
    for (const file of ['commands/ultragoal.md', 'skills/ultragoal/SKILL.md', 'docs/EXECUTION-HANDOFF.md']) {
      const body = readRepoFile(file);
      assert.match(body, /no 🔴 and no BLOCK/, `${file} maps the verdict by severity`);
      assert.match(body, /after (the goal is complete|all goals are complete|every goal is complete)/, `${file} applies accepted 🟡 changes after completion`);
    }
    assert.match(readRepoFile('commands/ultragoal.md'), /every goal's acceptance criteria and the full diff/);
    assert.match(readRepoFile('commands/ultragoal.md'), /before final proof, and only in files owned by completed change goals/);
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

  it('defect plans and converging reviews are pinned in bodies and adapters', () => {
    const pins = {
      'commands/ralplan.md': ['Plans record decisions, not code', 'Review focus', 'Defect plans', 'failing before the fix and passing after it', 'Verdict: conclusive | inconclusive', 'correct any drift', 'what to leave unflagged', 'such a plan is still `ready`', 'at least two viable options', 'each name the files they touch'],
      'skills/ralplan/SKILL.md': ['plans record decisions, not code', 'review focus', 'failing before the fix and passing after it', 'Verdict: conclusive | inconclusive', 'correct any drift', 'what to leave unflagged'],
      'commands/ultragoal.md': ['reuseGoalReview:true', 'review not converging', 'Before the first edit', 'fails for the reason the plan names', 'what to leave unflagged', 'closes only with an evidence artifact', 'free of cost or external effects'],
      'skills/ultragoal/SKILL.md': ['reuseGoalReview:true', 'review not converging', 'Before the first edit', 'what to leave unflagged', 'failing before the fix and passing after it', 'closes only with an evidence artifact'],
      'docs/EXECUTION-HANDOFF.md': ['review not converging', 'reuseGoalReview:true', 'what to leave unflagged', 'on Windows only the direct child'],
      'agents/critic.md': ['`symptom patch`', '`metric gaming`', 'Declined to judge', 'silence about an input is not permission', 'stays a finding'],
      'skills/critic/SKILL.md': ['`symptom patch`', '`metric gaming`', 'Declined to judge', 'silence about an input is not permission'],
      'agents/implementer.md': ['third failed attempt', 'reproduction check'],
      'skills/implementer/SKILL.md': ['third failed attempt', 'reproduction check'],
      'commands/deep-interview.md': ['up to three questions in total'],
      'skills/deep-interview/SKILL.md': ['up to three'],
      'commands/ship.md': ['detached HEAD', 'no new commit — shipped the commits already ahead of the base', 'in a command of its own'],
      'skills/ship/SKILL.md': ['detached HEAD'],
    };
    for (const [file, phrases] of Object.entries(pins)) {
      const body = readRepoFile(file);
      for (const phrase of phrases) assert.ok(body.includes(phrase), `${file} pins "${phrase}"`);
    }
    assert.doesNotMatch(readRepoFile('commands/deep-interview.md'), /never a batch/);
  });

  it('review blind spots, live test evidence, final proof reuse, and interview residual gaps are pinned in bodies and adapters', () => {
    const diffRules = ['committed secret', 'callers outside the diff', '`unreached code`'];
    const pins = {
      'agents/critic.md': [...diffRules, 'Plan constraints', "in any environment where the plan's verification or the repository's CI runs", 'a quoted Constraint'],
      'skills/critic/SKILL.md': diffRules,
      'commands/verify.md': ['zero tests'],
      'skills/verify/SKILL.md': ['zero tests'],
      'commands/ship.md': ['zero tests'],
      'skills/ship/SKILL.md': ['zero tests'],
      'agents/implementer.md': ['zero tests'],
      'skills/implementer/SKILL.md': ['zero tests'],
      'commands/ralplan.md': ['how the shipped change can fail', 'the violation each must catch', '`Residual gaps`', 'no safe default'],
      'skills/ralplan/SKILL.md': ['how the shipped change can fail', 'violation each must catch', 'Residual gaps'],
      'commands/deep-interview.md': ['two plausible answers', '`Residual gaps`'],
      'skills/deep-interview/SKILL.md': ['two plausible answers', 'Residual gaps'],
      'commands/ultragoal.md': ['reuse:true', '`reused`', '`excerpt`', 'checkpoint, not a report', 'zero tests', 'Constraints and Non-goals'],
      'skills/ultragoal/SKILL.md': ['reuse:true', '/goal clear', 'zero tests'],
      'docs/EXECUTION-HANDOFF.md': ['/goal clear', 'reuse:true', 'zero tests'],
      'docs/CODEX-SETUP.md': ['by its position'],
      'skills/setup/SKILL.md': ['position'],
    };
    for (const [file, phrases] of Object.entries(pins)) {
      const body = readRepoFile(file);
      for (const phrase of phrases) assert.ok(body.includes(phrase), `${file} pins "${phrase}"`);
    }
    assert.doesNotMatch(readRepoFile('skills/deep-interview/SKILL.md'), /stop and report residual ambiguity/);
  });

  it('design quality: the visual rubric, Design direction, template tells, and the rendered audit are pinned in bodies and adapters', () => {
    assert.ok(existsSync(repoPath('skills/frontend-fundamentals/references/visual-design.md')), 'visual rubric missing');
    const pins = {
      'skills/frontend-fundamentals/references/visual-design.md': ['`template tell`', 'designDocPath', 'Design direction', 'T12', 'base wording', "in the page's language", 'How to check', 'outside the audit scope', 'not a fix-loop target', 'nearest existing semantic token'],
      'skills/frontend-fundamentals/SKILL.md': ['(references/visual-design.md)'],
      'commands/ralplan.md': ['Design direction', 'visual-design.md', 'First viewport', 'How to check', 'under their own names and order', 'nearest existing semantic token'],
      'skills/ralplan/SKILL.md': ['Design direction', 'under their own names and order'],
      'commands/verify.md': ['--design', '1440', '768', '375', '`template tell`', 'visual-design.md', 'design audit needs a route', 'after the reached-route check', 'not saved as a baseline', 'outside the audit scope', 'not a fix-loop target', 'a note for the designer'],
      'skills/verify/SKILL.md': ['--design', '768', 'template tell'],
    };
    for (const [file, phrases] of Object.entries(pins)) {
      const body = readRepoFile(file);
      for (const phrase of phrases) assert.ok(body.includes(phrase), `${file} pins "${phrase}"`);
    }
    // Regression guards: the audit adds no tools to the report-only commands.
    const verify = parseFrontmatter(readRepoFile('commands/verify.md'));
    assert.match(verify['argument-hint'], /--design/);
    assert.equal(verify['allowed-tools'], 'Read, Bash(playwright-cli:*), Bash(curl:*), Bash(command -v:*), mcp__playwright__*, mcp__plugin_playwright_playwright__*');
  });

  it('verify detects the dev server without curl, and objective defects stay red under a Figma design', () => {
    const verifyBody = readRepoFile('commands/verify.md');
    assert.doesNotMatch(verifyBody, /curl -sf "\$BASE"/, 'commands/verify.md no longer needs curl to detect the dev server');
    assert.ok(verifyBody.includes('the first navigation'), 'commands/verify.md detects the dev server from the first navigation');
    assert.ok(readRepoFile('skills/verify/SKILL.md').includes('first navigation'), 'the Codex verify adapter detects the dev server from the first navigation');
    assert.ok(readRepoFile('skills/frontend-fundamentals/references/visual-design.md').includes('stay 🔴 even then'), 'the rubric keeps objective defects red under Figma');
  });

  it('ultragoal hands reviewers files, parallelizes the final stage, keeps paid checks out of final proof, and runs the team lane', () => {
    // Each phrase exists only in the rule it pins; none appears in the bodies before 0.20.0.
    const pins = {
      'commands/ultragoal.md': ['`critic`', '--output=', 'same turn as', 'not part of the final proof', '`implementer`', 'verification route', 'TaskUpdate', 'allowlist stale'],
      'skills/ultragoal/SKILL.md': ['--output=', 'same turn as', 'not part of the final proof', 'three failing final reviews', 'verification route', 'TaskUpdate'],
      'docs/EXECUTION-HANDOFF.md': ['--output=', 'same turn as', 'not part of the final proof', 'three failing final reviews', 'verification route', 'TaskUpdate'],
      'commands/ralplan.md': ['expected lane', 'not part of the final proof', 'parallel implementers'],
      'skills/ralplan/SKILL.md': ['expected lane', 'not part of the final proof', 'parallel implementers'],
      'agents/implementer.md': ['observation dispatch', 'TaskUpdate'],
      'skills/implementer/SKILL.md': ['observation dispatch', 'TaskUpdate'],
    };
    for (const [file, phrases] of Object.entries(pins)) {
      const body = readRepoFile(file);
      for (const phrase of phrases) assert.ok(body.includes(phrase), `${file} pins "${phrase}"`);
    }
  });

  it('both critic copies judge by one finding-kind list', () => {
    // Every labelled kind reads the same way in the agent and its Codex adapter, and both carry the
    // refute-before-report step.
    const FINDING_KINDS = ['verification weakened', 'metric gaming', 'symptom patch', 'unreached code', 'repo rule', 'scope expansion', 'template tell', 'over-build'];
    for (const file of ['agents/critic.md', 'skills/critic/SKILL.md']) {
      const body = readRepoFile(file);
      for (const kind of FINDING_KINDS) assert.ok(body.includes(`\`${kind}\``), `${file} pins "\`${kind}\`"`);
    }
    for (const file of ['agents/critic.md', 'skills/critic/SKILL.md']) {
      assert.ok(readRepoFile(file).includes('Refuted:'), `${file} pins "Refuted:"`);
    }
  });

  it('the open-ledger notice, the user-step rule, the unchecked-gap line, and the no-question rule are pinned where each lane reads them', () => {
    // The planner's two copies announce an open ledger and move every step left to the user into Your move;
    // the executor's report names what it did not check; the no-question rule lives where the inline lead
    // reads it, not only in the agent file that loads when a teammate is spawned.
    const pins = {
      'open ledger': ['commands/ralplan.md', 'skills/ralplan/SKILL.md'],
      'stays in `Your move`': ['commands/ralplan.md', 'skills/ralplan/SKILL.md'],
      'not checked': ['agents/implementer.md', 'skills/implementer/SKILL.md', 'commands/ultragoal.md', 'skills/ultragoal/SKILL.md', 'docs/EXECUTION-HANDOFF.md'],
      'asks no question': ['commands/ultragoal.md', 'skills/ultragoal/SKILL.md', 'docs/EXECUTION-HANDOFF.md'],
    };
    for (const [phrase, files] of Object.entries(pins)) {
      for (const file of files) assert.ok(readRepoFile(file).includes(phrase), `${file} pins "${phrase}"`);
    }
  });

  it('execution does not pre-approve arbitrary checks through its state helper', () => {
    const tools = parseFrontmatter(readRepoFile('commands/ultragoal.md'))['allowed-tools'];
    assert.doesNotMatch(tools, /Bash\(node [^)]*goal-state\.mjs:\*\)/);
    assert.doesNotMatch(tools, /Bash\((?:npm|pnpm|yarn|node):\*\)/);
  });
});

describe('OMJ 2.0 routes, plain reports, and single-critic planning', () => {
  const FIVE_PARTS = /Conclusion[^.\n]*Your move[^.\n]*What changed[^.\n]*Decisions made for you[^.\n]*How it was checked[^.\n]*REPORTING\.md/;

  it('the reporting commands and their Codex adapters name the five parts in order and point at REPORTING.md', () => {
    for (const name of ['ralplan', 'ultragoal', 'verify', 'ship']) {
      for (const file of [`commands/${name}.md`, `skills/${name}/SKILL.md`]) {
        assert.match(readRepoFile(file), FIVE_PARTS, `${file} names the five parts in one sentence and points at REPORTING.md`);
      }
    }
  });

  it('no fixed English report label survives in a prompt surface', () => {
    const files = listTrackedFiles('commands/*.md', 'agents/*.md', 'skills/**/*.md', 'output-styles/*.md');
    assert.ok(files.length >= 20, `only ${files.length} prompt files enumerated`);
    for (const file of files) {
      const source = readRepoFile(file);
      for (const label of ['Skipped / not checked / risk:', 'Hand-back:', 'Expected execution:', 'Critique: ready']) {
        assert.ok(!source.includes(label), `${file} still carries "${label}"`);
      }
    }
  });

  it('ultragoal and adaptive execution carry the playbook route rules and no direct route', () => {
    for (const file of ['commands/ultragoal.md', 'docs/ADAPTIVE-EXECUTION.md']) {
      const body = readRepoFile(file);
      for (const phrase of ['`playbook`', 'creates no ledger', 'asks no question', 'docs/playbooks/<type>.md', 'principles/INDEX.md', "playbook's `Review`", 'After three failing reviews, stop and report', 'hand the rest to `ralplan`', '`investigation`']) {
        assert.ok(body.includes(phrase), `${file} pins "${phrase}"`);
      }
    }
    for (const file of ['commands/ultragoal.md', 'docs/ADAPTIVE-EXECUTION.md', 'skills/ultragoal/SKILL.md', 'agents/implementer.md', 'skills/implementer/SKILL.md']) {
      assert.doesNotMatch(readRepoFile(file), /\bdirect\b/i, `${file} still names a direct route`);
    }
    assert.doesNotMatch(readRepoFile('docs/EXECUTION-HANDOFF.md'), /direct route|Direct tasks|route is direct/);
    assert.match(readRepoFile('skills/ultragoal/SKILL.md'), /playbook/);
  });

  it('ralplan spawns at most one critic for one pass, and the critic has no architect lens', () => {
    for (const file of ['commands/ralplan.md', 'skills/ralplan/SKILL.md']) {
      const body = readRepoFile(file);
      assert.doesNotMatch(body, /architect/i, `${file} still names an architect reading`);
      assert.doesNotMatch(body, /two reviewers|second pass|revision rounds|delta pass/i, `${file} still allows a second planning reading`);
      assert.ok(body.includes('more than two target files'), `${file} names when the critic runs`);
      assert.ok(body.includes('exactly one `critic`'), `${file} caps the critic at one`);
      assert.ok(body.includes('one pass'), `${file} caps the critic at one pass`);
    }
    for (const file of ['agents/critic.md', 'skills/critic/SKILL.md']) {
      const source = readRepoFile(file);
      assert.doesNotMatch(source, /architect/i, `${file} still carries an architect lens`);
      assert.ok(source.includes('plain-language verdict'), `${file} opens with a plain-language verdict`);
      assert.ok(source.includes('.omj/review/last-request.md'), `${file} grounds a playbook review in the saved request`);
    }
  });

  it('ultragoal prints progress per finished goal, handles a refused review, and reopens a capped final audit', () => {
    for (const file of ['commands/ultragoal.md', 'skills/ultragoal/SKILL.md']) {
      const body = readRepoFile(file);
      assert.ok(body.includes('When a goal completes, print the progress line'), `${file} prints one line per finished goal`);
      assert.ok(body.includes('When the helper refuses to record a review'), `${file} handles the helper's review cap`);
      assert.match(body, /`resume` with `\{expectedRevision,scope:"final"\}`/, `${file} reopens a capped final audit`);
    }
    assert.doesNotMatch(readRepoFile('commands/ultragoal.md'), /At each ledger transition/);
  });

  it('verify reports not confirmed with check strength, and the implementer records temporary measures and invents no work', () => {
    for (const file of ['commands/verify.md', 'skills/verify/SKILL.md']) {
      const body = readRepoFile(file);
      for (const phrase of ['`not confirmed`', 'check strength', 'scaled-down full-page capture', 'fixed-viewport capture']) {
        assert.ok(body.includes(phrase), `${file} pins "${phrase}"`);
      }
    }
    for (const file of ['agents/implementer.md', 'skills/implementer/SKILL.md']) {
      const body = readRepoFile(file);
      assert.ok(body.includes('temporary measure'), `${file} reports a temporary measure`);
      assert.ok(body.includes('condition for removing it'), `${file} names when a temporary measure goes away`);
      assert.ok(body.includes('rather than inventing work'), `${file} waits instead of inventing work`);
    }
  });
});
