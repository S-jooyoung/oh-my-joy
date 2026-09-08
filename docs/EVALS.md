# How OMJ evolves — the eval loop

OMJ's behavior is written in Markdown, so a "small wording change" in a command body is a behavior change. This document is the canon for measuring those changes instead of eyeballing them.

## What exists

- **`evals/`** — one directory per case: `prompt.md` (frontmatter + the prompt the case sends) and `graders/*.md` (one grader per file). Fixture workspaces live in `evals/fixtures/<name>/`; a case's `scaffold_script` copies the fixture into the sandbox before the run.
- **`npm run eval`** — runs the cases. It prefers Claude Code's native `claude plugin eval` (early access, enabled per organization; the runner detects "currently in early access" and falls back). The fallback, `scripts/eval-runner.mjs`, reads the same case files and drives `claude -p --plugin-dir . --output-format stream-json`, scoring the grader subset it understands (`regex`, `tool_used`, `file_exists`, `llm`), saving every run's final message and grader results as `results/<stamp>/<case>/run-N.md` and `run-N.json`, and writing the same `aggregate-result.json` shape (each arm carries an `outputPath` to its run). One case format, two runners, so switching to native later needs no rewrite. `tests/eval-runner.test.mjs` drives the runner against a stub `claude` (`OMJ_EVAL_CLAUDE_BIN`), so the harness itself is under test without spending tokens.
- **`tests/token-budget.test.mjs`** — the always-on description cost of every surface, ratcheted. It runs on every PR because it is free; the eval cases run on demand because they cost tokens.

## Discovery metadata budget

The static estimate is deliberately simple and reproducible. For each row it computes `Math.round((name + description + argument-hint).length / 4)` and sums the results. This estimate excludes Codex namespacing, resolved paths, catalog framing, and every other installed plugin, so it is a repository ratchet rather than a prediction of the warning threshold.

| Surface | Catalog ceiling | Per-description ceiling |
| --- | ---: | ---: |
| Codex plugin: 14 skills | 600 estimated tokens | 180 characters; `critic`, `design-qa`, `implementer`, and `spec` use 120 |
| Claude plugin descriptions | 1,700 estimated tokens | 180 characters for shared `SKILL.md` entries; command and agent descriptions are aggregate-only |
| Repository maintainer skills | 120 estimated tokens total | 180 characters |

The pre-change baseline was 918 estimated Codex tokens and 1,973 Claude tokens. The planning candidate was 467 and 1,522, leaving 133 and 178 tokens of headroom; these are labeled planning estimates because the test output at the release commit is the final measurement. Maintainer skills are measured separately because they are repository-local and are not part of the published 14-skill inventory.

The descriptions preserve the following routing contract:

| Skill | Trigger | Role | Authority boundary |
| --- | --- | --- | --- |
| `deep-interview` | Fuzzy intent or an explicit requirements interview | Clarify one question per round, then hand requirements to ralplan | Read-only; does not implement |
| `ralplan` | Concrete code, Figma, requirements, or PR-review planning | Produce one critiqued, decision-complete plan | Read-only; stops at native approval |
| `ultragoal` | An approved OMJ plan or its resume | Execute and record the approved goals through final evidence | No scope expansion; delivery only when the plan authorized it |
| `review` | Working-tree, branch, or PR diff review | Report correctness, FF, accessibility, and test findings | Report-only; does not edit or resolve delivery |
| `verify` | Post-implementation proof, with an optional route | Run declared checks or inspect the live route and report evidence | Report-only; does not fix failures |
| `fix` | A concrete frontend visual or behavioral defect | Diagnose, edit, and recapture until the scoped defect is repaired | Mutates only the requested fix scope |
| `sync` | Explicit token check, extract, push, or sync | Reconcile file tokens and Figma Variables | User selects conflict direction before writes |
| `ship` | Explicit ship, push, or new-PR request | Verify, commit, push, and open the PR | Never inferred from finished code; merge is outside its scope |
| `setup` | OMJ readiness check or selected installation | Inspect dependencies and install selected integrations or scaffolds | Check mode is read-only; normal mode changes selected items only |
| `spec` | Compatibility invocation for ralplan inputs | Route unchanged to the canonical ralplan workflow | Same read-only approval gate as ralplan |
| `frontend-fundamentals` | Writing, changing, or reviewing React components or hooks | Supply readability, predictability, cohesion, coupling, and a11y guidance | Delegates only the specialist checks its references name |
| `critic` | Parent ralplan or review requests an independent lens | Challenge plan or diff assumptions in fresh context | Internal and read-only; never a user execution lane |
| `design-qa` | Parent workflow requests the mechanical frontend gate | Run non-mutating checks and return binary evidence | Internal and report-only; never fixes code |
| `implementer` | Parent ultragoal dispatches one approved goal | Implement the owned files and return verification evidence | Internal; approved scope and file ownership are fixed |

## Codex native skill-catalog smoke

This smoke tests discovery and progressive disclosure without running an OMJ workflow. Use the release candidate in one fresh session with the same model and configuration as the comparison run:

```bash
codex exec --ephemeral --sandbox read-only --json -C <repo> -
```

Send this prelude verbatim on stdin, replacing only `<SCENARIOS>` with the table's numbered scenario text in order. Do not include the expected skill names in the prompt:

```text
Read-only skill-catalog smoke. Do not execute the requested workflow, mutate files, call external services, or dispatch an agent.

Scenarios:
<SCENARIOS>

Phase 1: Do not read files or call tools. Using only the available skill catalog metadata, emit one JSON object with event="catalog_mapping" and a mappings array. Each mapping contains the scenario number, the single selected OMJ skill name, and a one-sentence reason. Finish all mappings before Phase 2.
Phase 2: Read each unique selected skill's actual SKILL.md file once through a read-only file tool. For each unique skill, emit one JSON object with event="body_receipt", the skill name, the resolved path, and two concrete contract facts found in the body that are absent from the scenario text.

A skill name in the mapping is not a body receipt. Stop after the mapping object and one receipt per unique skill.
```

| # | Scenario text |
| ---: | --- |
| 1 | `Plan a rate-limit middleware for the public API with repository-backed acceptance evidence.` |
| 2 | `Plan a checkout implementation from https://figma.com/design/example?node-id=1-2 and verify it at /checkout.` |
| 3 | `Plan how to address review comments on https://github.com/example/acme/pull/123 without processing them yet.` |
| 4 | `Turn my fuzzy idea for an internal notification system into decision-complete requirements.` |
| 5 | `Execute and resume the approved OMJ plan through final recorded evidence.` |
| 6 | `Review the current working-tree diff and report findings without edits.` |
| 7 | `Prove the finished change with the repository's declared commands and report their exit codes.` |
| 8 | `Fix the misaligned mobile checkout button and recapture the result.` |
| 9 | `Check drift between CSS design tokens and Figma Variables, then ask me to choose any conflict direction.` |
| 10 | `Ship the verified change by committing, pushing, and opening a pull request.` |
| 11 | `Check whether this repository is ready for OMJ without changing configuration.` |
| 12 | `Refactor this React hook and component for readability and accessibility, using only the specialist checks the frontend guide routes to.` |
| 13 | `The user explicitly invoked $oh-my-joy:spec for a concrete backend task.` |
| 14 | `Parent ralplan dispatch: independently challenge this non-trivial draft plan with the architect lens.` |
| 15 | `Parent ultragoal dispatch: run the non-mutating mechanical frontend quality gate.` |
| 16 | `Parent ultragoal dispatch: implement approved goal G2 in the files assigned to this worker.` |

The observed trace must show the complete phase-1 mapping event before any body-file or tool read, then exactly one read receipt and phase-2 receipt for each of the 14 unique selected skills. Capture stderr separately for the shortened-description warning when the runner exposes it. If stderr is unavailable, record the warning as `unobserved`. This proves only the tested Codex CLI model/configuration; App verification needs a fresh App thread and its own observed catalog. The invocation consumes model usage, but it does not run the full paid behavioral eval suite.

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
/oh-my-joy:ralplan "add a rate limiter to the public API — 100 requests per minute per API key"
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
| `/oh-my-joy:ralplan` | `ralplan-single-approval`, `spec-general-text`, `spec-frontend-text`, `spec-critique-gate`, `spec-from-interview` | the two spec shapes, the approved goal units and handoff sections, read-only, the `## Critique` section with its decision record and simulated tasks, and an interview's requirements taken as input without re-asking |
| `/oh-my-joy:ultragoal` | `ultragoal-requires-plan` | rejects unapproved raw work without code or ledger mutation |
| `/oh-my-joy:deep-interview` | `deep-interview-gate` | the suitability gate exits on concrete input without asking |
| `/oh-my-joy:review` | `review-mixed-diff`, `review-rerun-delta` | both file classes with severities; a second pass reports prior findings first and only the delta |
| `/oh-my-joy:verify` | `verify-evidence-mode` | evidence rows with exit codes and an evidence kind, and a failing verdict on red |
| `/oh-my-joy:ship` | `ship-on-shared-branch`, `ship-stops-on-red` | branches before committing, reuses an established base without a question, stops on failed verification |
| `/oh-my-joy:fix` | `fix-commit-stops-on-failed-recheck` | explicit `--commit` does not bypass a failed final recheck; no staging, branch, or commit mutation |
| answer style | `style-korean-answer` | fluent Korean, respects explanation-only scope without forced internal handoffs, no edits |

## Enablement check

```bash
cd "$(mktemp -d)" && claude plugin eval
# "No eval cases found"                  → native runner available
# "plugin eval is currently in early access" → fallback runner is used
```

The new goal-state helper is also exercised through real child processes in `tests/goal-state.test.mjs`: resume, lock/CAS contention, corrupted state, failed or stale proof, review failure, and incomplete PR readback all block false completion. These tests do not claim a live GitHub delivery; that requires an explicitly authorized PR and readback.

## Workflow verification — 2026-09-08

- `npm test`: 509 passed, zero failed or skipped. Goal-state coverage includes 17 real child-process scenarios.
- `npm run validate-plugin`: passed the local Claude/Codex schema checks and both strict Claude manifest checks. The existing root `CLAUDE.md` warning remains accepted.
- Live Claude fallback runs: `ralplan-single-approval` passed 6/6 graders; `ultragoal-requires-plan` passed 5/5. Both exited 0 without timeout or source-write tool calls. The latter trace contains an actual `Skill(oh-my-joy:ralplan)` invocation and stops at final approval with automatic ultragoal continuation described.
- The admission case uses a one-line README task to isolate routing and approval. An earlier rate-limiter admission run invoked ralplan and its two reviewers but hit the 300-second limit; it is a failed run, not independent-review completion evidence.
- These single-prompt runs do not exercise the interactive approval-to-execution stretch, Codex live continuation, or real GitHub delivery. The ledger protocol is verified separately through subprocess tests; a release smoke must cover the remaining live paths.
