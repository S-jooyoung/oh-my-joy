---
name: ralplan
description: "Plan coding tasks, Figma designs or PR feedback from current evidence. Read-only; critique the plan and hand approved work to ultragoal."
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Ralplan

Read [the canonical ralplan contract](../../commands/ralplan.md) completely, then turn the input into the one plan the user approves. Also read [execution handoff](../../docs/EXECUTION-HANDOFF.md) and, for frontend/Figma work, [frontend fundamentals](../frontend-fundamentals/SKILL.md) plus only the references it routes to.

## Codex adapter

- Work in native Plan mode when available. Repository, Figma, documentation, and PR exploration stays read-only.
- Check Node.js 20+ and Git-worktree prerequisites. For a non-Git target, include `git init` only as an explicit approved local setup step when appropriate; otherwise state that ultragoal cannot start its durable ledger. Never initialize during planning.
- Use `rg`, `rg --files`, file reads, and read-only git/GitHub commands. For PR review, retrieve all paginated threads/comments, compare them with the current head, and preserve the canonical read-only versus explicit-processing authority boundary.
- Use official current documentation for unfamiliar or version-sensitive APIs when it affects an implementation decision. Do not invent a separate research workflow.
- The lead is the planner. For the canonical non-trivial threshold, spawn two fresh native reviewers in parallel using exposed `architect` and `critic` roles when available; otherwise use an available general native role and the [OMJ critic contract](../critic/SKILL.md) with the corresponding lens. Never invent a native agent type or require another plugin. Pass the draft and target files and retain the contexts only for delta review. Cap revision at two rounds and disposition disagreements explicitly. If subagents are unavailable or prohibited, perform the self-check and say so.
- Ask structured user input only for a blocker still unresolved after the critique cap. Repository facts are discovered, not asked.

Return the complete final plan inside exactly one `<proposed_plan>` block. Include goal units, acceptance evidence, final review, authorized delivery, and `## Critique`. Do not ask a lane question or “should I proceed?”. The plan block is the sole approval handoff. After approval, execution continues through the installed `oh-my-joy:ultragoal` skill without another approval or repeated task prompt.

Use `$oh-my-joy:ralplan <figma-url | PR-url | task> [verification-route]`. Empty input is accepted only when decision-complete interview requirements are already in context.
