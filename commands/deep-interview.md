---
description: General-purpose deep interview that turns vague ideas/requirements into a spec via Socratic one-question rounds and an ambiguity score — for "interview me" ("인터뷰해줘"), "let's sort the requirements first" ("요구사항부터 정리하자"), "still fuzzy about what to build", "deep interview" requests. Does not fire on requests that already carry file paths/acceptance criteria (announces immediate exit), and Figma links/FE implementation requests go to /omj first. Canonical invocation is /oh-my-joy:deep-interview
argument-hint: "[idea description [--threshold N]]"
allowed-tools: Read, Grep, Glob, AskUserQuestion
---

# /oh-my-joy:deep-interview — General-purpose requirement-clarification interview

Digs into a vague idea with one question per round, and once ambiguity drops below the threshold,
**presents the implementation spec as a native Plan body and stops**. It writes no code and creates
no files — materializing the spec is the post-approval execution stage's job.

> ✅ **read-only.** allowed-tools has no Write/Edit/Bash/Task. Brownfield fact-gathering is done
> directly with `Read`/`Grep`/`Glob`, and questions go through `AskUserQuestion` only.
>
> **Justification for multi-round questioning (PRINCIPLES ⑪ interview class).** Every interview
> question re-satisfies ⑪'s four conditions each round — it is default-free ambiguity that depends
> on the previous answer, *data discovered during execution*. This command therefore operates as
> the separate interaction class that ⑪ canonically approves: a hard cap of 20 rounds, early exit
> allowed after round 3, and "stop" honored at any time.

## Arguments

- The idea description (free text). If empty, print usage and stop.
- `--threshold N` — exit-threshold ambiguity (%). Default 20.

## Phase 0 — Suitability gate

An interview is only valuable where ambiguity exists. Judge before starting:

1. If the input has a figma.com URL or is an FE screen/component implementation request → the
   entry point is `/omj`, not this command. Announce and stop.
2. If the input is already concrete (two or more of: file paths, symbol names, numbered steps,
   acceptance criteria, error messages) → print "Already clear enough — proceed without an
   interview" with the judgment rationale and stop. A small desire for confirmation does not
   create interview value.
3. Otherwise → announce `Deep interview threshold: N%` on the first line and begin.

**Brownfield detection**: if the cwd has source/package files and the input points to modifying or
extending something existing, it is brownfield. Explore the relevant code first to secure facts —
**never ask the user what the code already answers**, and cite evidence (file paths, symbols) in
confirmation questions.

## Round 0 — Topology confirmation

Before scoring anything, pin down the **shape** of the scope once. Extract 1–6 top-level components
that can succeed/fail independently from the input and confirm them in a single question
(add/remove/merge/defer). Without this gate, depth-first questioning overfits the most verbosely
described component and hides sibling components' ambiguity. The confirmed topology becomes the
scoring unit for every subsequent round.

## Interview loop

Each round:

1. **Target selection** — among active components × dimensions (goal/constraints/success criteria/
   context if brownfield), pick the lowest-scoring pair. Rotate when several components are
   similarly weak.
2. **One question** — state in one sentence why this point is the current bottleneck, then ask an
   assumption-exposing question via `AskUserQuestion` (choices + free input). Never batch questions.
3. **Scoring** — update per-dimension 0.0–1.0 scores and gaps from the answer and compute ambiguity:
   - greenfield: `1 − (goal×0.40 + constraints×0.30 + success criteria×0.30)`
   - brownfield: `1 − (goal×0.35 + constraints×0.25 + success criteria×0.25 + context×0.15)`
   - If an answer contradicts earlier statements or widens the scope, that dimension's score **may
     go down** (ambiguity is not monotonically decreasing).
4. **Ontology tracking** — extract the key entities (nouns) each round and compare with the previous
   round. Stability ratio = (kept+renamed)/total — renames count as convergence. If entities keep
   shifting, stop detail questions and switch to "what is this thing essentially?" questions.
5. **Report** — show the score table (dimension·score·gap), the ambiguity, and the next target every
   round.

**Cadence**: after round 3, if the user says "good enough, proceed", show the residual gaps with a
warning and allow early exit. At round 10, confirm whether to continue; round 20 is the hard cap.

## Exit gates (double)

When ambiguity ≤ threshold, do not jump straight to the spec — pass two gates:

1. **Restate** — show the one-sentence restated goal **verbatim in the question body** and get it
   confirmed (asking "is this right?" without showing it is forbidden; at most twice).
2. **Closure audit** — even when the math passes, self-check: does every active component have a
   verifiable success criterion; does every deferred item carry a reason. If deficient, state
   "the score passes but {gap} keeps this open" and return to the loop.

## Output — spec = native Plan

Present the full spec as the response body (the plan file if in Plan mode) and **stop**:

- Goal (one sentence) / topology (active·deferred with reasons) / constraints / non-goals /
  verifiable acceptance criteria
- Table of exposed·resolved assumptions / key entities (ontology) / final ambiguity and
  per-dimension scores
- For brownfield, the technical context secured by exploration (files·patterns cited)

**Execution bridge** — at the end of the spec, point to whichever paths apply:

- If it became an FE implementation spec: after approval, paste this spec into `/omj` to develop it
  into a uSpec implementation spec (spec paste is a first-class input).
- If the work must survive interruption or prove its completion with evidence: after approval,
  paste this spec into `/oh-my-joy:goal-loop` to see it through as a durable goal loop (paste is a
  first-class input; lane definitions: `docs/EXECUTION-HANDOFF.md`).
- Otherwise: after approval, the current session implements inline per the spec.

If the user wants the spec saved as a file, the post-approval execution stage saves it — this
command never writes.

## Usage

```
/oh-my-joy:deep-interview I want a knowledge base to replace the team wiki but it's still fuzzy
/oh-my-joy:deep-interview notification system overhaul --threshold 15
```

> Methodology source: adapted and rewritten from the deep-interview methodology of the
> open-source projects credited in [NOTICE.md](../NOTICE.md) (runtime path
> `${CLAUDE_PLUGIN_ROOT}/NOTICE.md`). The runtime and state-file conventions were not ported.
