# OMJ execution handoff routing

This document is the **single routing SoT** for OMJ execution-lane selection. README, `docs/OMC-INTEGRATION.md`, `docs/PRINCIPLES.md`, `commands/omj.md`, and `commands/omj-start.md` only summarize or link to it, and **never redefine the scoring signals or thresholds**.

> **One exception**: in case this file is unreachable at runtime, `commands/omj.md` carries a minimal **threshold-free** fallback mapping (small → inline/manual, durable goal → wrapper, parallel lanes → team, …). Numbers and conditions live only here; the fallback gives direction only — the boundary that satisfies graceful degradation (PRINCIPLES ⑨) and single SoT (⑧) at once.

## Model: Wrapper + Sublane

- **Wrapper**: durable state/checkpoint owner.
  - `none`: very small one-shot work.
  - `/goal` or `$ultragoal`: work that needs multiple stages, multiple turns, or checkpoints.
  - `/oh-my-joy:goal-loop`: OMJ's own durable wrapper — **always present even without an
    OMC/OMX runtime** (an always-available axis, not a runtime row). It persists goal state
    in `.omj/goals/` and accepts completion only through validator evidence objects.
- **Sublane**: how execution actually runs.
  - `inline/manual`: no OMC/OMX, or very small work.
  - `$ralph`/`/ralph`: when one persistent owner must push through and verify to the end.
  - `$team`/`/team`: when there are 2+ parallelizable implementation/doc/verification lanes.
- **QA follow-up**: `$ultraqa`/`/ultraqa`, when the goal is adversarial e2e/hostile QA after implementation.
- **Consensus fallback**: `/oh-my-claudecode:ralplan` (OMC), `$ralplan` (OMX), or `/oh-my-joy:ralplan` (OMJ native — no runtime needed, lightweight one-pass critic consensus), for work that is still ambiguous or needs architectural consensus. **Runtime asymmetry**: OMC `/oh-my-claudecode:ralplan` connects to execution (team/ralph) once consensus is approved, but OMX `$ralplan` currently **stops after producing the plan** behind the host receipt gate (fail-closed) — after consensus the user must start the execution lane separately, and when the selector recommends this lane in an OMX context it must say so.

## Recommendation inputs

Lane recommendation weighs these signals together.

- touched file count
- screen/route count
- separable lanes count
- uncertainty
- risk
- verification need
- expected multi-turn duration
- OMC/OMX availability

## Recommendation rules

1. **Small and concrete**: 1–2 files, 1 route, no new abstractions → `Wrapper: none`, `Sublane: inline/manual` or `ralph`.
2. **Durable goal**: 3+ files, multiple stages, restart/checkpoint needed → `Wrapper: $ultragoal` or `/goal`. **If neither exists, `/oh-my-joy:goal-loop`** — and when evidence-enforced completion matters most, this lane may be chosen even with a runtime present (priority rules in the "OMJ native lane" section below).
3. **Parallelizable**: 2+ independent lanes (screens/docs/verification) → `Sublane: $team` or `/team`.
4. **Sequential pressure**: low parallelism but the completion/verification loop matters → `Sublane: $ralph` or `/ralph`.
5. **QA-only**: implementation is done and the goal is hostile-scenario / visual-interaction defect hunting → recommend `$ultraqa`/`/ultraqa` as option 1.
6. **Ambiguous/high-risk**: requirements, boundaries, or architecture unclear → recommend `/oh-my-claudecode:ralplan`/`$ralplan` first (with the plan-only note in OMX contexts — see Consensus fallback above). Without OMC/OMX, `/oh-my-joy:ralplan`.
7. **No runtime**: no OMC/OMX → if durable is needed, `/oh-my-joy:goal-loop`; otherwise print a copyable manual command/action and do not fail.

## OMJ native lane (`/oh-my-joy:goal-loop`)

This is **not a row in the runtime table but an always-present durable option** (regardless of OMC/OMX). Rules:

- **Priority**: when OMC `/goal` or OMX `$ultragoal` is available, the default recommendation
  is still that lane (wider orchestration reach). `/oh-my-joy:goal-loop` is ① the durable
  default when no runtime exists, and ② listed as an explicit option even with a runtime
  when the goal is "evidence-enforced completion, single-owner sequencing". Selector notation
  must distinguish canonical invocations — `Wrapper: /goal` (OMC) and
  `Wrapper: /oh-my-joy:goal-loop` (OMJ) are different lanes.
- **Auto-select boundary**: `/oh-my-joy:goal-loop` is also a heavy lane — when recommended,
  ask **exactly one question**, same as every other heavy lane (no silent progression).
- **Full-cycle composition**: fuzzy ideas become specs via `/oh-my-joy:deep-interview`,
  FE signals become uSpec via `/omj`, and this lane consumes the approved spec — the executor
  of an FE goal is `figma-implementer`, and the verification layer (design-qa · `/omj-verify` ·
  `/omj-fix` · `/omj-sync` · `/oh-my-joy:ff-review`) is shared unchanged. Standalone `/omj`
  usage is unaffected.

## Auto-select rule (question skipped for inline/manual only)

Only when the recommended lane is **`Wrapper=none; Sublane=inline/manual`** does the selector skip `AskUserQuestion`, recording `Selected lane: Wrapper=none; Sublane=inline/manual (auto)` in the spec instead.

- **Rationale**: here the answer is self-evident and the question would only add prompt fatigue (PRINCIPLES ⑪ — don't ask what is inferable and cheap). The blast radius of a wrong call is small — worst case, "proceed on the cheapest lane" or the user corrects it on the approval screen.
- **Boundary**: if `$team`/`$ultragoal`/`/goal`/`$ralph`/`$ralplan`/`$ultraqa` is the recommendation, **always ask exactly once** (no silent progression on heavy lanes).
- **Consent point**: Plan approval (ExitPlanMode) is the lane consent. If the user disagrees, they edit the plan file on the approval screen or re-select in `/omj-start`.
- **After approval of an `(auto)` spec**: there is no separate lane to launch, so `/omj-start` is unnecessary — the current session proceeds with inline implementation directly.

## Selector output contract

Option 1 must always be the recommendation and carries `(recommended)` (if the auto-select condition applies, skip the question and only record `(auto)` on the `Selected lane` line in the format below). When both a Wrapper and a Sublane apply, write them separated within one line.

```md
## Execution lane selection
1. Wrapper: $ultragoal; Sublane: $team (recommended) — multiple doc/command/verification lanes can be split; checkpoints needed.
2. Wrapper: none; Sublane: $ralph — one owner implements/verifies sequentially.
3. QA follow-up: $ultraqa — hostile QA/fix loop after implementation.

Selected lane: Wrapper=$ultragoal; Sublane=$team

If auto-start is not possible after approval, run exactly this one line:
/omj-start <approved-spec-or-plan-path>
```

## `/omj-start` fallback contract

- If the spec already contains the lane `/omj` chose (whether manually selected or an `(auto)` record), never re-ask.
- Only when no lane selection exists, ask the same single selector exactly once.
- If a direct launch is possible and safe, launch.
- If a direct launch is not possible, or slash/dollar command semantics are unclear, print exactly one copyable command/action.
- The OMX ultragoal direct launch is **two-stage**: `omx ultragoal create-goals --brief-file '<path>'` only **creates** the durable goal; starting/resuming belongs to `omx ultragoal complete-goals` — after running create-goals, the final copyable action must be `omx ultragoal complete-goals`.
- Never run `/goal clear` automatically. Print it as an explicit user action only when a previously completed goal blocks a new same-thread goal.

## Syntax map

| Runtime | Durable wrapper | Team sublane | Ralph sublane | UltraQA | Ralplan |
| --- | --- | --- | --- | --- | --- |
| Codex/OMX | `$ultragoal` + Codex `/goal` | `$team` / `omx team`¹ | `$ralph` | `$ultraqa` | `$ralplan` (plan-only) |
| Claude/OMC | `/goal` | `/team` | `/ralph` | `/ultraqa` | `/oh-my-claudecode:ralplan` |
| No runtime | `/oh-my-joy:goal-loop` | manual | manual | manual QA checklist | `/oh-my-joy:ralplan` |

¹ In sessions outside the Codex App and tmux, do not offer `$team`/`omx team` directly — the OMX CLI must be started from a shell first (OMX README).

## Clear/start safety

- Native Plan approval is the handoff/clear point for the plan gate.
- Terminal/stale OMC/OMX state can be cleared only by the active execution workflow's documented cleanup path.
- Active unrelated `/goal` must not be cleared silently.
- `/omj` and `/omj-start` must never hide destructive or irreversible state changes behind "start".
