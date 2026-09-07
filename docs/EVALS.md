# How OMJ evolves — the eval loop

OMJ's behavior is written in Markdown, so a "small wording change" in a command body is a behavior change. This document is the canon for measuring those changes instead of eyeballing them.

## What exists

- **`evals/`** — one directory per case: `prompt.md` (frontmatter + the prompt the case sends) and `graders/*.md` (one grader per file). Fixture workspaces live in `evals/fixtures/<name>/`; a case's `scaffold_script` copies the fixture into the sandbox before the run.
- **`npm run eval`** — runs the cases. It prefers Claude Code's native `claude plugin eval` (early access, enabled per organization; the runner detects "currently in early access" and falls back). The fallback, `scripts/eval-runner.mjs`, reads the same case files and drives `claude -p --plugin-dir . --output-format stream-json`, scoring the grader subset it understands (`regex`, `tool_used`, `file_exists`, `llm`), saving every run's final message and grader results as `results/<stamp>/<case>/run-N.md` and `run-N.json`, and writing the same `aggregate-result.json` shape (each arm carries an `outputPath` to its run). One case format, two runners, so switching to native later needs no rewrite. `tests/eval-runner.test.mjs` drives the runner against a stub `claude` (`OMJ_EVAL_CLAUDE_BIN`), so the harness itself is under test without spending tokens.
- **`tests/token-budget.test.mjs`** — the always-on description cost of every surface, ratcheted. It runs on every PR because it is free; the eval cases run on demand because they cost tokens.

## Case format

`evals/<case>/prompt.md`:

```md
---
name: spec-general-text
tags: [spec, general]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill]
scaffold_script: cp -R "$EVAL_FIXTURES/node-service/." .
---
/oh-my-joy:spec "add a rate limiter to the public API — 100 requests per minute per API key"
```

`evals/<case>/graders/<grader>.md` — frontmatter selects the grader; the body carries a pattern or a rubric:

```md
---
type: regex
pattern: "## Completion procedure"
match: contains
target: last_message
---
```

```md
---
type: tool_used
tool: Write
max: 0
---
```

```md
---
type: llm
criteria: The spec states verification commands taken from package.json scripts and lists at least three checkable acceptance criteria.
---
```

Grader types: `regex` (`pattern`, `flags`, `match: contains | not_contains | count:N`, `target: last_message | trace | files`), `tool_used` (`tool`, `input_match`, `min`, `max` — `max: 0` means "never called"), `tool_order` (`before`, `after`), `file_exists` (`path`), `llm` (`criteria`, `focus`), `baseline`. The native runner supports all of them; the fallback runner supports the first four plus `llm`.

## The loop

1. Before changing a command body, run its case once and keep the score: `npm run eval -- --case "review-*" --runs 1`. One run of one case is the unit of local work; the three-run suite is for a release.
2. Change the body. If the change alters what the command promises, add or update the case that observes that promise — a case is the executable version of the body's output contract.
3. Run again. Paste before and after into the PR's Test plan. A regression is a finding, not a formality.
4. On a release, the release job runs the whole suite with a cost ceiling and records the pass rate next to the content hash in the release notes.

## Thresholds and cost

- `npm run eval` passes `--threshold 0.8`: a case scores below 0.8 when at least one grader in more than one of its three runs fails. A grader the judge could not score (no parseable verdict after two attempts) is excluded from the mean and counted in `aggregates.judgeFailures`, so harness flakiness shows up as a number instead of a zero.
- Measured on 2026-09-07: one run of a spec case costs about $1.3–2.6, a review or verify case $0.9–1.3 (the CLI's own estimate; on a subscription login it counts against the plan's usage instead of a bill). Budget about $2 per case per run.
- `--max-cost-usd` is checked before a run starts, against the money already spent plus an estimate of the run (the case's previous run, else `--run-cost-estimate`, default 2). A run that started is always graded, judge calls included — an ungraded run is spend that bought nothing. When the budget is below one run's estimate, nothing starts and the runner says so; exit 2 in both cases, with whatever completed written out.
- With `--ablation with-without` (the native default when a plugin resolves) each case also runs without the plugin, and the delta is the number that shows what OMJ adds. The fallback runner has no ablation arm.
- Cases that need MCP servers (the Figma track) are second-phase: they wait for recorded mocks under `evals/mocks/`.
- The independent critique (two `critic` agents on a non-trivial plan) is exercised by hand before a release rather than by a case: it spawns subagents, so one run costs roughly three runs' worth, and the fixtures are two-file services that take the self-critique path. Run the spec on a three-file task with `Agent` allowed and read the saved `run-1.md` for `ready (independent: 2 lenses`.
- Interactive loops are outside the single-prompt harness: the interview's question rounds (and its ambiguity floor) and the stretch after approval (the execution rules) cannot be driven by one `claude -p` prompt. Those are exercised by self-application — a release that changes them records a transcript of the new bodies in use in its PR — while the gates they leave behind (`## Critique`, the re-review table, the evidence kinds) have cases.

## Cases by command

| Command | Cases | What they pin |
| --- | --- | --- |
| `/oh-my-joy:spec` | `spec-general-text`, `spec-frontend-text`, `spec-critique-gate`, `spec-from-interview` | the two spec shapes, the lane and completion sections, read-only, the `## Critique` section with its decision record and simulated tasks, and an interview's requirements taken as input without re-asking |
| `/oh-my-joy:deep-interview` | `deep-interview-gate` | the suitability gate exits on concrete input without asking |
| `/oh-my-joy:review` | `review-mixed-diff`, `review-rerun-delta` | both file classes with severities; a second pass reports prior findings first and only the delta |
| `/oh-my-joy:verify` | `verify-evidence-mode` | evidence rows with exit codes and an evidence kind, and a failing verdict on red |
| `/oh-my-joy:ship` | `ship-on-shared-branch`, `ship-stops-on-red` | never commits on a shared branch; stops when a verification command fails |
| answer style | `style-korean-answer` | fluent Korean, next-step pointer, no edits |

## Enablement check

```bash
cd "$(mktemp -d)" && claude plugin eval
# "No eval cases found"                  → native runner available
# "plugin eval is currently in early access" → fallback runner is used
```
