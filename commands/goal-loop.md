---
description: Single-owner sequential execution loop that drives an approved spec/plan to completion in durable goal units — for "run this plan with goal-loop" ("이 플랜 goal-loop로 돌려줘"), work spanning multiple turns, resume-after-interruption, or evidence-backed completion (run outside Plan mode). Goal state persists in .omj/goals/ and completion cannot exist without an evidence object. Canonical invocation is /oh-my-joy:goal-loop
argument-hint: "[spec/plan path or paste] [--slug <name>]"
allowed-tools: Read, Grep, Glob, AskUserQuestion, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-state.mjs:*)
---

# /oh-my-joy:goal-loop — Durable goal execution loop

Splits an approved spec/plan into a goal list persisted at `.omj/goals/<slug>/` and sees it through —
**one goal at a time**: implement → verify → record evidence → next goal. A broken session resumes
under the same slug.

> ⚙️ **The validator is the only state-mutation path.** This command's allowed-tools has no
> Write/Edit — every creation/transition/closure in `.omj/goals/` happens only through
> `node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-state.mjs` calls, and the script checks the valid
> transition table, evidence prerequisites, the append-only ledger, and atomic snapshot swaps,
> rejecting violations with a non-zero exit. Attempts to write state files directly fall outside
> pre-approval and surface as permission prompts (PRINCIPLES ③ — no silent bypass).
>
> **Evidence-collection commands are never pre-approved.** Pre-allowing per-project test/build
> commands would launder a narrow pre-approval into arbitrary execution. A permission prompt on
> every verification command (`npm test` etc.) is the **intended UX** — that confirmation is what
> makes the evidence trustworthy.

## Input

- The approved spec/plan: a file path or a **pasted body** (first-class input — including `/oh-my-joy:spec`·`/oh-my-joy:deep-interview` output).
- `--slug <name>`: the state directory name (lowercase letters, digits, hyphens). An existing slug means **resume mode**.

## Flow

1. **Initialize** — extract the goal list (title·objective) of independently completable goals from the spec, confirm it, then:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-state.mjs init --slug <slug> --brief-file <spec> --goals-json '<goals>'`
   (In resume mode, read the current state with `status` instead of init; if the snapshot and ledger
   disagree, re-derive from the ledger with `reconcile`, then continue from the remaining goals.)
2. **Start a goal** — `transition --goal <id> --to active`. The transition table: pending→active,
   active→complete/blocked/failed, blocked→active, failed→active. **Only one goal is active at a
   time** (single owner) — concurrent writers and parallel mutation are unsupported by contract.
3. **Implement** — the current session implements directly. For FE goals, the `figma-implementer`
   agent is the executor. Parallel subagents are for **read-only investigation only** — the one
   writing state files is always this session.

   > Not pre-approving `Task` in allowed-tools is deliberate — subagents do not inherit the
   > parent's allowed-tools, so the permission prompt raised at spawn time becomes the user
   > confirmation point (PRINCIPLES ③ — removing the permission is itself the safety gate).
4. **Verify·complete** — run the goal's verification command (approve the permission prompt) and
   record the result as evidence via
   `transition --goal <id> --to complete --evidence-json '<evidence>'`. Evidence is not a raw
   output dump but **command·exit code·summary** (no secrets or personal data):

```json
{
  "verification": {
    "status": "passed",
    "commands": ["node --test"],
    "evidence": "157 passed, 0 failed — including the new goal-state suite"
  }
}
```

5. **Handling blockage** — blockers you can clear yourself (broken build, missing file) are
   **resolved without stopping**. Only for blockers that just the user can clear (credentials,
   external approval, scope decisions), `transition --to blocked --reason '<reason>'` then one
   `AskUserQuestion` — a decision depending on data discovered during execution, satisfying ⑪'s
   four conditions. When review/verification reveals follow-up work, never manipulate goals —
   append a blocker goal with `add-goal`.
6. **Close** — once every goal is complete with evidence, `close --slug <slug>`. If any goal is
   pending/blocked/failed, close is rejected — there is no bypass path.

The ledger (`ledger.jsonl`) accumulates `plan_created`·`goal_started`·`goal_completed`·
`goal_blocked`·`goal_resumed`·`goal_failed`·`goal_added`·`plan_closed` events append-only
(in the {"event": "goal_completed"} shape) — progress reporting, resumption, and post-hoc audit
are all possible from this single file.

## git policy

`.omj/goals/` is **operational state and is never committed** — add it to the consuming project's
`.gitignore` at the same tier as `.omj/baselines/` (`/oh-my-joy:setup` guides this during scaffolding).
It differs in tier from the committed `.omj/fe-context.md` (the project declaration), so ignoring
`.omj/` wholesale loses fe-context — specify only `goals/`·`baselines/`.

## Usage

```
/oh-my-joy:goal-loop ./approved-spec.md --slug search-form
/oh-my-joy:goal-loop --slug search-form          # resume an interrupted loop
```

> Methodology source: adapted and rewritten from the open-source projects credited in
> [NOTICE.md](../NOTICE.md) (runtime path `${CLAUDE_PLUGIN_ROOT}/NOTICE.md`). The runtime was not ported.
