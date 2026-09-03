# OMJ execution handoff routing

This document is the single routing source of truth for OMJ execution-lane selection and for the completion procedure that follows approval. README, `docs/PRINCIPLES.md`, `commands/spec.md`, and `commands/deep-interview.md` only summarize or link to it and never redefine the signals, thresholds, or the procedure.

> One exception: if this file is unreachable at runtime, `commands/spec.md` carries a threshold-free fallback (small → inline; iterate-until-condition → `/goal`; three or more independent units with disjoint files → agent team; fuzzy requirement → `/oh-my-joy:deep-interview` first). Numbers and conditions live only here.

## The three lanes

- **inline** — the default. After approval the current session implements the spec directly; for frontend specs the bundled `figma-implementer` agent is the standard executor. Always available.
- **`/goal`** — Claude Code's native goal loop: persistence within a session. It keeps the session iterating until the stated completion condition is judged met (the evaluator judges what the session surfaced; it runs nothing itself). Part of the hooks system, so it is unavailable where hooks are disabled or the workspace is untrusted; fall back to inline.
- **agent team** — Claude Code's native Agent Teams: parallel teammates with a shared task list, dependencies, and direct messaging. Pick it when the spec has three or more independent units (sections of a large Figma frame, separate modules, docs beside code) whose owned files do not overlap. Experimental and off by default; the section below says how it is enabled and what OMJ adds on top.

Agents (`figma-implementer`, `design-qa`) are executors, never lanes, and are not listed in the selector.

## Agent team lane — native Agent Teams plus OMJ's dispatch contract

**Enabling.** Agent Teams run only when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set in the shell or in `settings.json` under `env`; `/oh-my-joy:setup` offers to add it. Without the flag Claude creates no teammates, so the lane degrades: first to ordinary subagents (the `Agent` tool, results reported back to the session, no shared task list), and when those are unavailable too, to inline, sequentially. The spec's copyable action stays valid in every case because it is a plain-language instruction.

**Dispatch contract.** A section-mode spec ends with a Dispatch table — `Section | Figma node | Teammate | Owns files | Verify command`. The rows are the shared task list: one task per row, owned files disjoint across rows (teammates editing the same file overwrite each other), and one verification command per row. The teammate type is `figma-implementer` for frontend rows; general rows use a plain teammate with the spec as its brief. The definition's tools and body apply to the teammate; its skills and MCP frontmatter do not, so the spawn prompt carries the spec path.

**Copyable action** (the one line the spec prints for this lane):

```text
Spawn one teammate per row of the Dispatch table using the figma-implementer agent type, named by the Teammate column. Each implements only its row from <spec path>, edits only its Owns-files, and reports completion with evidence (command · exit 0 · summary). Wait for all teammates, then run /oh-my-joy:verify <route>.
```

**Barrier.** The lead does not implement while teammates work; it waits, then runs `/oh-my-joy:verify` as the barrier before `/oh-my-joy:review`. A teammate's "done" without evidence is not done — the lead asks for the evidence or reassigns the task.

**Sizing.** Three to five teammates, five or six tasks each, is the range the platform documents as productive; beyond it coordination cost outgrows the parallel gain. One team per session, no nested teams, and teammates start with the lead's permission mode — pre-approve the routine commands before spawning so prompts do not bubble up for every file.

## Recommendation inputs

Lane recommendation weighs these signals together: touched file count, screen or route count, count of separable units, uncertainty, risk, verification need, expected multi-turn duration.

## Recommendation rules

1. **Small and concrete**: 1–2 files, 1 route, no new abstractions → inline.
2. **Iterate-until-condition**: a crisp completion condition that needs retries within this session (make the tests pass, drive the diff to zero) → `/goal`. Without native goal support, inline.
3. **Parallelizable**: three or more independent units with disjoint owned files → agent team. Without the flag, subagents; without subagents, inline sequentially.
4. **Fuzzy**: the requirement itself is unclear → `/oh-my-joy:deep-interview` before any spec; the lane is chosen once the spec exists.

## Auto-select rule (question skipped for inline only)

Only when the recommended lane is inline does the selector skip `AskUserQuestion`, recording `Selected lane: inline (auto)` in the spec. Here the answer is self-evident and a question would only add fatigue; the blast radius of a wrong call is small, and the user corrects it on the approval screen. When `/goal` or agent team is recommended, the selector asks exactly once; option 1 is the recommendation and carries `(recommended)`. Plan approval (ExitPlanMode) is the lane consent. After approval of an `(auto)` spec there is nothing to launch — the session proceeds inline.

## Selector output contract

```md
## Execution lane selection
1. Lane: agent team (recommended) — 4 independent sections with disjoint files.
2. Lane: /goal — iterate in this session until the stated condition holds.
3. Lane: inline — implement directly in this session.

Selected lane: agent team

After approval, run exactly this one line:
<copyable action>
```

Copyable-action shapes per lane: `/goal "<completion condition for the approved spec>"` · the agent-team spawn line above · nothing for inline.

## Completion procedure

Every approved spec (from `/oh-my-joy:spec` or `/oh-my-joy:deep-interview`) ends with this section, and the session follows it after approval by invoking the commands as skills. Nothing in it runs before approval; everything in it is what the user approved.

```md
## Completion procedure
After approval: implement on the selected lane → /oh-my-joy:review → /oh-my-joy:verify <route or none> → (visual defects) /oh-my-joy:fix <route> until clean → report with evidence. /oh-my-joy:ship is yours to run.
```

- `/oh-my-joy:review` reads the diff against the spec's acceptance criteria and reports.
- `/oh-my-joy:verify` runs in browser mode when the spec recorded a route, otherwise in evidence mode with the spec's verification commands. On the agent-team lane it is also the barrier after the teammates finish.
- `/oh-my-joy:fix` loops only for frontend work and only while verify reports visual defects.
- The report closes with the evidence (command · exit code · summary) and the one line to run next.
- `/oh-my-joy:ship` is never run automatically: pushing and opening a PR are visible to others, so that step is the user's.

## Clear/start safety

- Native Plan approval is the handoff point for the plan gate.
- Never run `/goal clear` automatically. Print it as an explicit user action only when a previously completed goal blocks a new same-thread goal.
- An active unrelated `/goal` is not cleared silently.
- The spec's lane section never hides destructive or irreversible state changes behind "start".
