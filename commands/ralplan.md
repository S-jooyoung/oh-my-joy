---
description: Read-only command that turns an existing spec/plan artifact into consensus via adversarial review by an independent critic — for "consensus-review this plan" ("이 플랜 합의 리뷰해줘"), "check whether the design decisions leave room for dissent", i.e. when the artifact to review already exists. If the requirement itself is fuzzy, /oh-my-joy:deep-interview comes first (that is Q&A clarification; this is artifact adversarial review — different functions). Canonical invocation is /oh-my-joy:ralplan
argument-hint: "[spec/plan path or paste]"
allowed-tools: Read, Grep, Glob
---

# /oh-my-joy:ralplan — Plan consensus review

Normalizes an already-written spec/plan, has an **independent critic push back**, and on
convergence stops at `pending approval`. It writes no code and creates no files — the output is a
native Plan/response body, and materialization belongs to the post-approval execution stage
(paste is a first-class input).

> ✅ **read-only.** allowed-tools has no Write/Edit/Bash/Task. The critic review is owned by an
> **independent subagent** per the procedure below; in environments without a subagent surface,
> the current session degrades to a separated critic pass and labels the result "reduced
> independence" (⑨).

## Entry conditions

- The input **must contain** an artifact to review (a spec/plan file path or pasted body).
  If absent, print usage and stop — if the requirement is still fuzzy, point to
  `/oh-my-joy:deep-interview`.
- For small plans whose design decisions are self-evident with no dissent risk, print "proceeding
  without consensus review recommended" with the rationale and stop — never tax every plan with
  review cost.

## Flow (v1 — one critic pass, at most 2 rounds)

1. **Planner normalization** — the current session organizes the artifact into a consensus-ready
   shape: Decision Drivers (top 3) · **Viable Options ≥2** (for a single option, the invalidation
   rationale for alternatives) · verifiable acceptance criteria · ADR (decision·rationale·discarded
   alternatives·consequences). For thin input, do not merely enumerate — surface missing scope and
   assumptions to enrich it.
2. **Independent critic review** — hand the normalized plan and the original artifact path to the
   `plan-critic` agent (tools: Read/Grep/Glob — an ownership definition whose tool surface is
   pinned by tests).

   > Not pre-approving `Task` in allowed-tools is deliberate — the permission prompt raised at
   > spawn time becomes the user confirmation point (PRINCIPLES ③, the same rule as goal-loop's
   > implementation stage).
   The critic actually reads the file references to verify them, simulates 2–3 representative
   implementation items against the real code, and distinguishes fatal flaws from "thin, needs
   expansion" in its verdict (`OKAY`/`ITERATE`/`REJECT` + a list of grounds).
3. **Revision loop** — on `ITERATE`, revise once incorporating the findings, then re-review.
   **Review rounds are capped at 2.**
4. **Closure** —
   - `OKAY` → present the consensus plan as `pending approval` and stop (ExitPlanMode/approval is
     the user's — this command never starts execution).
   - Not converged after 2 rounds → declare **PLANNING-STUCK**: preserve the best plan, itemize the
     unresolved disputes, and **do not execute**. Dispute resolution goes to a user decision or to
     `/oh-my-joy:deep-interview` (when the problem is at the requirements layer).

## After approval

Executing the consensus plan follows the existing lane selection — for FE implementation, develop
it into an `/omj` spec; when durable completion is needed, `/oh-my-joy:goal-loop`; with OMC/OMX
installed, the corresponding lane (`docs/EXECUTION-HANDOFF.md` is the canon).

## Usage

```
/oh-my-joy:ralplan ./approved-spec.md
/oh-my-joy:ralplan   (paste the full plan body)
```

> Methodology source: adapted from the consensus structure of gajae-code ralplan (review join,
> PLANNING-STUCK, RALPLAN-DR), reduced in v1 to a single critic pass —
> [NOTICE.md](../NOTICE.md) (runtime path `${CLAUDE_PLUGIN_ROOT}/NOTICE.md`). The Architect second
> pass gets added when high-risk triggers (security, migration, public API) are actually observed.
