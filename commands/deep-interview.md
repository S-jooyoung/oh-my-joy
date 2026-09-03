---
description: General-purpose deep interview that turns vague ideas/requirements into a spec via Socratic one-question rounds and an ambiguity score — for "interview me" ("인터뷰해줘"), "let's sort the requirements first" ("요구사항부터 정리하자"), "still fuzzy about what to build", "deep interview" requests. Does not fire on requests that already carry file paths/acceptance criteria (announces immediate exit), and Figma links/FE implementation requests go to /oh-my-joy:spec first. Canonical invocation is /oh-my-joy:deep-interview
argument-hint: "[idea description [--threshold N]]"
allowed-tools: Read, Grep, Glob, AskUserQuestion
---

# /oh-my-joy:deep-interview — Requirement-clarification interview

Dig into a vague idea one question per round, and once ambiguity drops below the threshold, present the implementation spec as a native Plan body and stop. This command writes no code and creates no files; materializing the spec belongs to the execution stage after approval.

The tools are `Read`/`Grep`/`Glob` for brownfield facts and `AskUserQuestion` for the questions — nothing else. Asking one question per round is deliberate: each question depends on the previous answer, which is data that did not exist before the round, so it cannot be replaced by a flag or a default. Three bounds keep it finite: a hard cap of 20 rounds, early exit allowed after round 3, and "stop" honored at any time.

## Arguments

- The idea description (free text). If empty, print Usage and stop.
- `--threshold N` — exit-threshold ambiguity in percent. Default 20.

## Phase 0 — Suitability gate

An interview is only valuable where ambiguity exists, so judge before starting:

1. A figma.com URL or a frontend screen/component implementation request belongs to `/oh-my-joy:spec`. Announce that and stop.
2. Input that is already concrete — two or more of: file paths, symbol names, numbered steps, acceptance criteria, error messages — gets "Already clear enough — proceed with `/oh-my-joy:spec`" plus the reason, and stops. A small wish for confirmation does not create interview value.
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
4. Ontology — extract the key entities (nouns) and compare with the previous round. Stability ratio = (kept + renamed) / total; renames count as convergence. If entities keep shifting, stop asking detail questions and ask "what is this thing essentially?" instead.
5. Report — the score table (dimension, score, gap), the ambiguity, and the next target.

Cadence: after round 3, if the user says "good enough, proceed", show the residual gaps with a warning and allow early exit. At round 10, confirm whether to continue; round 20 is the hard cap.

## Exit gates

When ambiguity is at or below the threshold, pass two gates before writing the spec:

1. Restate — show the one-sentence restated goal verbatim in the question body and get it confirmed (asking "is this right?" without showing it defeats the purpose; at most twice).
2. Closure audit — even when the math passes, check that every active component has a verifiable success criterion and every deferred item carries a reason. If not, say "the score passes but {gap} keeps this open" and return to the loop.

## Output — the spec is the Plan

Present the full spec as the response body (the plan file when in Plan mode) and stop:

- Goal (one sentence) / topology (active and deferred, with reasons) / constraints / non-goals / verifiable acceptance criteria / verification commands where the work has them
- Table of exposed and resolved assumptions / key entities / final ambiguity and per-dimension scores
- For brownfield, the technical context secured by exploration (files and patterns cited)

Then append the same two closing sections `/oh-my-joy:spec` uses — `## Execution lane selection` and `## Completion procedure` — following the routing rules in `${CLAUDE_PLUGIN_ROOT}/docs/EXECUTION-HANDOFF.md` (repo-relative `docs/EXECUTION-HANDOFF.md`): ask the lane question only when a lane heavier than inline is recommended, and record the completion procedure the session follows after approval (implement → `/oh-my-joy:review` → `/oh-my-joy:verify` → report; `/oh-my-joy:ship` is the user's). If the spec turned out to be a frontend implementation spec, say so and suggest pasting it into `/oh-my-joy:spec` to develop it into a uSpec-based spec before approval. If the user wants the spec saved as a file, the execution stage saves it.

## Usage

<example>
```
/oh-my-joy:deep-interview I want a knowledge base to replace the team wiki but it's still fuzzy
/oh-my-joy:deep-interview notification system overhaul --threshold 15
```
</example>

Methodology source: adapted and rewritten from the open-source projects credited in [NOTICE.md](../NOTICE.md) (runtime path `${CLAUDE_PLUGIN_ROOT}/NOTICE.md`). The runtime and state-file conventions were not ported.
