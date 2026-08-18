# OMJ execution handoff routing

This document is the **single routing SoT** for OMJ execution-lane selection. README, `docs/PRINCIPLES.md`, and `commands/spec.md` only summarize or link to it, and **never redefine the scoring signals or thresholds**.

> **One exception**: in case this file is unreachable at runtime, `commands/spec.md` carries a minimal **threshold-free** fallback mapping (small → inline; iterate-until-condition → `/goal`; parallel lanes → agent team; durable/evidence-gated → `/oh-my-joy:goal-loop`). Numbers and conditions live only here; the fallback gives direction only — the boundary that satisfies graceful degradation (PRINCIPLES ⑨) and single SoT (⑧) at once.

## The four lanes

- **inline** — the default. After approval, the current session implements the spec directly; for FE specs the bundled `figma-implementer` agent is the standard executor. Always available.
- **`/goal`** — Claude Code's native goal loop: persistence *within* a session — it keeps the session iterating until the stated completion condition is judged met. Requires Claude Code's native goal support (a hook-enabled environment); when unavailable, fall back to inline or `/oh-my-joy:goal-loop`.
- **agent team** — Claude Code's native parallel subagents: fan the approved spec out to 2+ agents when independent lanes exist (screens, docs, verification). Requires an environment where subagent spawning is available; when unavailable, fall back to inline, sequentially.
- **`/oh-my-joy:goal-loop`** — OMJ's own durable wrapper: persistence *across* sessions. Goal state lives in `.omj/goals/`, an interrupted run resumes with `--slug` alone, and completion is accepted only through the validator's evidence gate. Available everywhere; runs outside Plan mode.

**Consensus pass (not a lane)**: `/oh-my-joy:ralplan` — adversarial review of an existing spec/plan before approval, for work that is still ambiguous or carries design-disagreement risk.

## Recommendation inputs

Lane recommendation weighs these signals together.

- touched file count
- screen/route count
- separable lanes count
- uncertainty
- risk
- verification need
- expected multi-turn duration

## Recommendation rules

1. **Small and concrete**: 1–2 files, 1 route, no new abstractions → inline.
2. **Iterate-until-condition**: the work has a crisp completion condition and needs retries within this session (make the tests pass, drive the diff to zero) → `/goal`. Without native goal support, inline.
3. **Parallelizable**: 2+ independent lanes (screens/docs/verification) → agent team. Without subagent support, inline sequentially.
4. **Durable/evidence-gated**: multi-turn work that must survive interruption, or whose completion needs recorded evidence → `/oh-my-joy:goal-loop`. Even when `/goal` is available, prefer this lane when the evidence gate or cross-session resume matters most.
5. **Ambiguous/high-risk**: requirements, boundaries, or architecture unclear → run `/oh-my-joy:ralplan` on the spec before approval; pick the execution lane after consensus.

## Auto-select rule (question skipped for inline only)

Only when the recommended lane is **inline** does the selector skip `AskUserQuestion`, recording `Selected lane: inline (auto)` in the spec instead.

- **Rationale**: here the answer is self-evident and the question would only add prompt fatigue (PRINCIPLES ⑪ — don't ask what is inferable and cheap). The blast radius of a wrong call is small — worst case, "proceed on the cheapest lane" or the user corrects it on the approval screen.
- **Boundary**: if `/goal`, agent team, or `/oh-my-joy:goal-loop` is the recommendation, **always ask exactly once** (no silent progression on heavy lanes).
- **Consent point**: Plan approval (ExitPlanMode) is the lane consent. If the user disagrees, they edit the plan file on the approval screen.
- **After approval of an `(auto)` spec**: there is nothing to launch — the current session proceeds with inline implementation directly.

## Selector output contract

Option 1 must always be the recommendation and carries `(recommended)` (if the auto-select condition applies, skip the question and only record `(auto)` on the `Selected lane` line in the format below). The lane section always ends with the **one copyable action** for the selected lane — for inline there is nothing to run, so the line is omitted.

```md
## Execution lane selection
1. Lane: /oh-my-joy:goal-loop (recommended) — multi-turn work; completion must be evidence-gated.
2. Lane: /goal — iterate in this session until the stated condition holds.
3. Lane: inline — implement directly in this session.

Selected lane: /oh-my-joy:goal-loop

After approval, run exactly this one line:
/oh-my-joy:goal-loop <approved-spec-path> --slug <slug>
```

Copyable-action shapes per lane: `/goal "<completion condition for the approved spec>"` · a one-line dispatch note naming the independent lanes for agent team · `/oh-my-joy:goal-loop <approved-spec-path> --slug <slug>`.

## Gate orthogonality

`/oh-my-joy:spec` uses Claude Code's native Plan mode (ExitPlanMode) as a **read gate**; `/goal` and `/oh-my-joy:goal-loop` own their **execution gates** (the goal evaluator's condition · the validator's evidence object). The gates are orthogonal and meet only chronologically at the approval moment. The default flow is straight to the selected lane after approval — a `/oh-my-joy:ralplan` consensus pass is taken explicitly, and only when work is genuinely ambiguous or high-risk. "It's big" alone never forces a second planning gate.

## Clear/start safety

- Native Plan approval is the handoff/clear point for the plan gate.
- Never run `/goal clear` automatically. Print it as an explicit user action only when a previously completed goal blocks a new same-thread goal.
- An active unrelated `/goal` must not be cleared silently.
- The spec's lane section must never hide destructive or irreversible state changes behind "start".
