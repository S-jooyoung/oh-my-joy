---
description: General-purpose deep interview that turns vague ideas into decision-complete requirements via Socratic one-question rounds and an ambiguity score, then automatically hands them to ralplan without a second routing question. Exits at once on already-concrete input; Figma and concrete work go directly to ralplan
argument-hint: "[idea description [--threshold N]]"
allowed-tools: Read, Grep, Glob, Skill, AskUserQuestion
---

# /oh-my-joy:deep-interview — Requirement-clarification interview

Dig into a vague idea one question per round. Once ambiguity drops below the threshold and the closure audit passes, hand the requirements directly to `/oh-my-joy:ralplan`, which produces the one plan the user approves. This command writes no code and creates no files; materializing anything belongs to `ultragoal` after approval.

The tools are `Read`/`Grep`/`Glob` for brownfield facts, `AskUserQuestion` for interview questions, and `Skill` for invoking `ralplan` at the exit bridge. Asking one question per round is deliberate: each question depends on the previous answer. Three bounds keep it finite: a hard cap of 20 rounds, early exit allowed after round 3, and "stop" honored at any time.

## Arguments

- The idea description (free text). If empty, print Usage and stop.
- `--threshold N` — exit-threshold ambiguity in percent. Default 20.

## Phase 0 — Suitability gate

An interview is only valuable where ambiguity exists, so judge before starting:

1. A figma.com URL or a frontend screen/component implementation request belongs to `/oh-my-joy:ralplan`. Invoke it with the original input; do not make the user repeat the command.
2. Input that is already concrete — two or more of: file paths, symbol names, numbered steps, acceptance criteria, error messages — gets "Already clear enough — handing this to `/oh-my-joy:ralplan`" plus the reason, then invokes it. A small wish for confirmation does not create interview value.
3. Otherwise announce `Deep interview threshold: N%` on the first line and begin.

Brownfield detection: if the cwd has source or package files and the input points at modifying something that exists, explore the relevant code first with `Read`/`Grep`/`Glob` to secure facts. Ask the user nothing the code already answers, and cite evidence (paths, symbols) in confirmation questions.

## Round 0 — Topology

Before scoring anything, pin down the shape of the scope once: extract 1–6 top-level components that can succeed or fail independently and confirm them in a single question (add, remove, merge, defer). Without this gate, depth-first questioning overfits the most verbosely described component and hides its siblings' ambiguity. The confirmed topology is the scoring unit for every later round.

## Interview loop

Each round:

1. Target — among active components × dimensions (goal, constraints, success criteria, and context when brownfield), pick the lowest-scoring pair. Rotate when several are similarly weak.
2. One question — state in one sentence why this point is the current bottleneck, then ask an assumption-exposing question via `AskUserQuestion` with choices plus free input. One question per round, never a batch.
3. Score — update the 0.0–1.0 per-dimension scores and gaps from the answer and compute ambiguity:
   - greenfield: `1 − (goal×0.40 + constraints×0.30 + success criteria×0.30)`
   - brownfield: `1 − (goal×0.35 + constraints×0.25 + success criteria×0.25 + context×0.15)`
   - An answer that contradicts earlier statements or widens the scope may lower a dimension's score; ambiguity is not monotonic.
   - Floor: the ledger sets a floor the reported ambiguity cannot drop below — 10 points for each fact the user disputed and has not re-confirmed, 5 for each active component with an unscored dimension, and 5 × (rounds answered by assumption ÷ rounds scored). Report `max(computed, floor)` and show the floor whenever it binds, so the interview cannot close by under-reporting what is still open.
4. Ontology — extract the key entities (nouns) and compare with the previous round. Stability ratio = (kept + renamed) / total; renames count as convergence. If entities keep shifting, stop asking detail questions and ask "what is this thing essentially?" instead.
5. Report — the score table (dimension, score, gap), the ambiguity, and the next target.

Cadence: after round 3, if the user says "good enough, proceed", show the residual gaps with a warning and allow early exit. At round 10, confirm whether to continue; round 20 is the hard cap. Those two are the only continuation questions — an ordinary round never ends with "shall I continue?", because the gate decides continuation and a per-round consent prompt turns the score into friction. After three consecutive confirmation questions ("is X right?"), the next round asks a question that exposes an assumption: confirmations verify what is known, and the ambiguity lives in what is assumed.

## Exit gates

When ambiguity is at or below the threshold, pass two gates before writing the spec:

1. Restate — show the one-sentence restated goal verbatim in the question body and get it confirmed (asking "is this right?" without showing it defeats the purpose; at most twice).
2. Closure audit — even when the math passes, check that every active component has a verifiable success criterion and every deferred item carries a reason. If not, say "the score passes but {gap} keeps this open" and return to the loop.

## Exit bridge — requirements into ralplan

When both gates pass, present the requirements as the response body: goal (one sentence), topology (active and deferred, with reasons), constraints, non-goals, verifiable acceptance criteria, verification commands where the work has them, the table of exposed and resolved assumptions, key entities, the final ambiguity with per-dimension scores, and for brownfield the technical context secured by exploration (files and patterns cited). A dimension that only a measurement can score (a benchmark, user test, or spike) becomes a `Research first` row with what must be measured and why; `ralplan` performs only the research needed to settle that implementation decision.

Requirements are not yet a plan. The interview knows what to build and why; `ralplan` grounds target files, reuse candidates, verification, design detail, and independent critique. Invoke `/oh-my-joy:ralplan` through `Skill` immediately with the requirements in session context. There is no final route question and no small-work direct-plan exception: one canonical planner means one approval surface. If skill invocation is unavailable, continue by reading `commands/ralplan.md` in the current context; only when neither path exists print the exact `/oh-my-joy:ralplan` invocation.

Frontend, Figma, general engineering, and PR review requirements all use this same handoff. If the user wants the requirements saved, make that an explicit goal in the plan rather than writing during the interview.

## Usage

<example>
```
/oh-my-joy:deep-interview I want a knowledge base to replace the team wiki but it's still fuzzy
/oh-my-joy:deep-interview notification system overhaul --threshold 15
```
</example>

Methodology source: adapted and rewritten from the open-source projects credited in [NOTICE.md](../NOTICE.md) (runtime path `${CLAUDE_PLUGIN_ROOT}/NOTICE.md`). The runtime and state-file conventions were not ported.
