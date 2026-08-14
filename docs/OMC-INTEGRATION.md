# OMJ × OMC/OMX integrated workflow

> An in-depth reference for using oh-my-joy (OMJ) together with oh-my-claudecode (OMC) or oh-my-codex (OMX). If you arrived here from the README's "OMJ × OMC/OMX" summary, this document explains why the gates do not overlap, how responsibilities are divided, and the concrete flows per scenario (A/B/C). The single SoT for execution-lane routing is [`docs/EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md).

If you normally plan and execute with OMC/OMX, OMJ is the **frontend-specific on-ramp (spec authoring) + execution-lane selection + verification** stage of that flow. Planning with `/omj` does not replace the OMC/OMX planning/execution tools — the implementation spec `/omj` produces is exactly the input those execution tools consume.

## Mental model (one sentence)

"FE work always starts with `/omj` — after the spec is approved, take execution lane option 1 `(recommended)` unless there is a specific reason not to."

## One-line division of roles

- **Planning**: `/omj` (FE-context spec, native Plan + execution selector). Only large work that needs consensus is seeded into `/oh-my-claudecode:ralplan`/`$ralplan` after approval (runtime asymmetry — OMC `/oh-my-claudecode:ralplan` connects to execution on approval; OMX `$ralplan` is currently plan-only, stopping after the plan is produced. Canon: [`docs/EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md)).
- **Execution**: `/goal`/`$ultragoal` (durable goal/checkpoint) · `/team`/`$team` (parallel N agents) · `/ralph`/`$ralph` (sequential loop). `/omj-start` is the canonical fallback handoff when auto-start is not possible. On inline lanes (including `(auto)`), the bundled `figma-implementer` agent can serve as the standard executor of the approved spec — but a spec that selected an OMC/OMX lane always gives that lane priority (it is an executor a lane uses, not a lane).
- **Verification**: `/oh-my-joy:ff-review` (FE code diff) · `/omj-verify` (FE visual) · general OMC/OMX verification or `$ultraqa` (adversarial QA).

## Gate rule (why they don't overlap)

Only `/omj` uses Claude Code's native Plan mode (`ExitPlanMode`) as a **read gate**; OMC/OMX planning/execution tools use their own workflow/goal ledgers as **execution gates**. The two gates are **orthogonal** and meet only chronologically at the handoff moment.

So the default flow is:

1. `/omj` produces the FE spec and the execution-lane options.
2. The user approves the Plan.
3. Execute directly on the selected lane, or hand off with the single line `/omj-start <approved-spec>` when auto-start is not possible.

`/oh-my-claudecode:ralplan`/`$ralplan` consensus is taken explicitly only when work is ambiguous, high-risk, or needs architectural agreement. "It's big" alone never forces a second planning gate. `/oh-my-joy:deep-interview` (requirement clarification) is an always-available primer independent of any runtime, and when OMC/OMX is absent the two OMJ natives fill the durable-execution and consensus-review roles — `/oh-my-joy:goal-loop` (durable — priority canon: the "OMJ native lane" section of [EXECUTION-HANDOFF.md](EXECUTION-HANDOFF.md)) · `/oh-my-joy:ralplan` (consensus — the Consensus-fallback description in the same document).

## A. Ordinary FE work (simple to medium)

1. `/omj <figma-url|task> [route]` → implementation spec (Plan) + execution-lane selection.
2. Review and approve (ExitPlanMode).
3. If the selected lane is small: inline/manual or `/ralph`/`$ralph`; if file/verification lanes split: `/team`/`$team`.
4. Check the diff with `/oh-my-joy:ff-review` → visual check with `/omj-verify <route>`. On mismatch, fix and re-verify with `/omj-fix`. If tokens changed, `/omj-sync` (interactive: code is the default SoT but the user picks the direction on conflict — use `push` to force code through as-is).

## B. Large/complex FE (multiple screens · refactoring)

1. Author the core-screen spec with `/omj` (figma + FF/vercel) — pin target files, numbered stages, acceptance, and verification routes into the spec.
2. After approval (ExitPlanMode), put a `/goal` or `$ultragoal` wrapper around durable work.
3. If parallelizable implementation/doc/verification lanes exist, use `/team`/`$team` inside the wrapper. Under strong sequential-completion pressure, use `/ralph`/`$ralph`.
4. Only when genuinely ambiguous or consensus is needed, seed the spec into an explicit `/oh-my-claudecode:ralplan`/`$ralplan` after approval (OMX `$ralplan` is plan-only — start the execution lane separately after consensus. Without a runtime, `/oh-my-joy:ralplan` plays the same consensus role).
5. Per-screen `/oh-my-joy:ff-review` · `/omj-verify`, re-run on the remaining diff.

## C. Full-stack (FE+BE)

1. Shape the overall picture with OMC/OMX planning tools.
2. FE leaves = `/omj` priming → approval → the selected execution lane. BE = general OMC/OMX executor/worker.
3. Verification: FE `/oh-my-joy:ff-review` · `/omj-verify`, general BE verification, `$ultraqa` when needed.

## Handoff constraints (mechanism cautions)

- `/omj` is read-only and cannot write source code itself. File materialization/modification happens **after** `ExitPlanMode` approval, in the execution lane.
- `/omj` asks the execution-lane question **at most once** — if the recommendation is `Wrapper=none; Sublane=inline/manual` it does not ask and only records `(auto)` (Plan approval = lane consent); for any other recommended lane it asks exactly once with option 1 labeled `(recommended)`. The chosen value stays in the final spec (auto-select rule canon: `EXECUTION-HANDOFF.md`).
- When auto-start is not possible, print exactly the one line `/omj-start <approved-spec-or-plan-path>`. Never scatter multiple commands the user must re-adjudicate.
- Never run `/goal clear` automatically. Guide it as an explicit user action only when a previously completed goal blocks a new same-thread goal.
- OMC/OMX syntax and the wrapper/sublane split are canonical in [`docs/EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md). This document keeps only the flow narrative.

> **Gist**: for FE, "what to build" is extracted precisely by `/omj` with figma·FF context (prescription), and "how to run it" belongs to the OMC/OMX execution tools. The default is straight to the selected lane after approval; the consensus loop is used explicitly only for ambiguous or high-risk work.
