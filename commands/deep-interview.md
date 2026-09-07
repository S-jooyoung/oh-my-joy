---
description: General-purpose deep interview that turns vague ideas into requirements via Socratic one-question rounds and an ambiguity score — for "interview me" ("인터뷰해줘"), "let's sort the requirements first" ("요구사항부터 정리하자"), "still fuzzy about what to build". Ends with an exit bridge — hand the requirements to /oh-my-joy:spec (default) or plan directly for small work. Exits at once on already-concrete input; Figma links go to /oh-my-joy:spec. Canonical invocation is /oh-my-joy:deep-interview
argument-hint: "[idea description [--threshold N]]"
allowed-tools: Read, Grep, Glob, Skill, AskUserQuestion
---

# /oh-my-joy:deep-interview — Requirement-clarification interview

Dig into a vague idea one question per round, and once ambiguity drops below the threshold, hand the requirements to `/oh-my-joy:spec` for the implementation plan — or, for small work whose context the interview already secured, present the plan directly. This command writes no code and creates no files; materializing anything belongs to the execution stage after approval.

The tools are `Read`/`Grep`/`Glob` for brownfield facts, `AskUserQuestion` for the questions, and `Skill` for one thing: invoking `/oh-my-joy:spec` at the exit bridge. Asking one question per round is deliberate: each question depends on the previous answer, which is data that did not exist before the round, so it cannot be replaced by a flag or a default. Three bounds keep it finite: a hard cap of 20 rounds, early exit allowed after round 3, and "stop" honored at any time.

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
   - Floor: the ledger sets a floor the reported ambiguity cannot drop below — 10 points for each fact the user disputed and has not re-confirmed, 5 for each active component with an unscored dimension, and 5 × (rounds answered by assumption ÷ rounds scored). Report `max(computed, floor)` and show the floor whenever it binds, so the interview cannot close by under-reporting what is still open.
4. Ontology — extract the key entities (nouns) and compare with the previous round. Stability ratio = (kept + renamed) / total; renames count as convergence. If entities keep shifting, stop asking detail questions and ask "what is this thing essentially?" instead.
5. Report — the score table (dimension, score, gap), the ambiguity, and the next target.

Cadence: after round 3, if the user says "good enough, proceed", show the residual gaps with a warning and allow early exit. At round 10, confirm whether to continue; round 20 is the hard cap. Those two are the only continuation questions — an ordinary round never ends with "shall I continue?", because the gate decides continuation and a per-round consent prompt turns the score into friction. After three consecutive confirmation questions ("is X right?"), the next round asks a question that exposes an assumption: confirmations verify what is known, and the ambiguity lives in what is assumed.

## Exit gates

When ambiguity is at or below the threshold, pass two gates before writing the spec:

1. Restate — show the one-sentence restated goal verbatim in the question body and get it confirmed (asking "is this right?" without showing it defeats the purpose; at most twice).
2. Closure audit — even when the math passes, check that every active component has a verifiable success criterion and every deferred item carries a reason. If not, say "the score passes but {gap} keeps this open" and return to the loop.

## Exit bridge — requirements first, then the plan

When both gates pass, present the requirements as the response body: goal (one sentence), topology (active and deferred, with reasons), constraints, non-goals, verifiable acceptance criteria, verification commands where the work has them, the table of exposed and resolved assumptions, key entities, the final ambiguity with per-dimension scores, and for brownfield the technical context secured by exploration (files and patterns cited). A dimension that only a measurement can score (a benchmark, a user test, a spike) is not scored by guessing: it becomes a `Research first` row in the deferred table, with what has to be measured and why the plan waits on it.

Requirements are not yet a plan. The interview knows what to build and why; the implementation plan needs what the interview did not read — target files, reuse candidates, verification commands, the design — and a critique against that code. So the interview closes with one last round, an `AskUserQuestion` with the recommendation first and labeled `(recommended)`:

1. Plan with `/oh-my-joy:spec` — the default. Invoke `/oh-my-joy:spec` via `Skill`; the requirements in the session context are its input, so it reads the code, builds the plan, critiques it, and presents the Plan. Where the skill cannot be invoked, print the one line to type — `/oh-my-joy:spec` — and stop.
2. Plan directly from this interview — recommended only when the work is one or two files with no new abstraction, the brownfield exploration already secured the technical context, and every acceptance criterion is checkable. Run the self-critique `/oh-my-joy:spec` describes (Phase 3 of `${CLAUDE_PLUGIN_ROOT}/commands/spec.md`, repo-relative `commands/spec.md`): the assumptions table is the decision record, two or three representative tasks walked against the real files, the verdict as a `## Critique` section closing `Critique: ready (self)`. Then append the same two closing sections `/oh-my-joy:spec` uses — `## Execution lane selection` and `## Completion procedure` — following the routing rules in `${CLAUDE_PLUGIN_ROOT}/docs/EXECUTION-HANDOFF.md` (repo-relative `docs/EXECUTION-HANDOFF.md`): ask the lane question only when a lane heavier than inline is recommended, and record the completion procedure the session follows after approval (implement → `/oh-my-joy:review` → `/oh-my-joy:verify` → report; execution asks no questions and classifies blockers; `/oh-my-joy:ship` is the user's). Then stop.
3. Research first — offered only when `Research first` rows exist. List what has to be measured and why, and stop; nothing executes on an unscored dimension.

Frontend and Figma work always takes option 1: the uSpec sections and the fidelity rules live in `spec`. If the user wants the requirements saved as a file, the execution stage saves them.

## Usage

<example>
```
/oh-my-joy:deep-interview I want a knowledge base to replace the team wiki but it's still fuzzy
/oh-my-joy:deep-interview notification system overhaul --threshold 15
```
</example>

Methodology source: adapted and rewritten from the open-source projects credited in [NOTICE.md](../NOTICE.md) (runtime path `${CLAUDE_PLUGIN_ROOT}/NOTICE.md`). The runtime and state-file conventions were not ported.
