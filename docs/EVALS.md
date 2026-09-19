# How OMJ evolves — the eval loop

OMJ's behavior is written in Markdown, so a "small wording change" in a command body is a behavior change. This document is the canon for measuring those changes instead of eyeballing them.

## What exists

- **`evals/`** — one directory per case: `prompt.md` (frontmatter + the prompt the case sends) and `graders/*.md` (one grader per file). Fixture workspaces live in `evals/fixtures/<name>/`; a case's `case.yaml` names a `scaffold.sh` that copies the fixture into the run's workspace.
- **`npm run eval`** — runs the cases. It prefers Claude Code's native `claude plugin eval` (enabled per organization; the runner uses it only when a probe in an empty directory answers "No eval cases found", falls back on an early-access notice or an older CLI without the command, and `--fallback` forces the fallback). Natively it starts one `claude plugin eval` run per selected case, because native `--case` keeps only its last value, and overlaps up to `--jobs` of them (default 4, 1–8); each run gets `--trust-plugin --no-publish`, `--ablation with-without` for a case tagged `ablation` and `--ablation none` for the rest (an explicit `--ablation` applies to every selected case), `--scaffold` unless `--no-scaffold`, the case's own gated tools as `--allow-tools`, its own `--output-dir` under one stamp directory, `-j` for multi-run cases, a `runner.log`, and whatever remains of `--max-cost-usd`. Because a native ceiling cannot stop a run that is already the first in flight, the runner enforces the budget by reservation: a case starts only when spent + reserved + its estimate (the case's last native per-run cost, else `--run-cost-estimate`, times runs and arms) fits, waits for a running case to settle otherwise, and is recorded as not started when nothing is left to wait for. `summary.json` lists every case's exit code, mode, arms, cost, duration, score, and Δ (`delta`, from the aggregate's `meanDelta`) with `jobs`, `startedAt`, `finishedAt`, and `wallSeconds`, and the exit code is the worst one among the pass/fail cases: an ablation case that wrote its aggregate reports a Δ, which is a measurement rather than a verdict, so it changes the exit code only when that aggregate is partial; one that wrote none (a load error or a crash) still fails the run. Native grants are coarse even within a run — a case that lists any granted Bash pattern gets Bash for simple commands, one that lists none gets none. Cases tagged `fallback-only` are skipped natively, and the fallback skips cases tagged `ablation`, since it has no without-plugin arm. The fallback, `scripts/eval-runner.mjs`, reads the same case files and drives `claude -p --plugin-dir . --output-format stream-json` with the native run's isolation: `--tools` withholds every built-in tool the case does not list, and `--setting-sources project --strict-mcp-config` keeps personal settings and MCP servers out. Its trace is one JSON line per main-thread text or tool call (subagent messages and tool results stay out), and an llm grader with `focus: trace` sees the first 12 and last 12 lines, as the native judge does. It scores the grader subset it understands (`regex`, `tool_used`, `tool_order`, `file_exists`, `llm`), saving every run's final message and grader results as `results/<stamp>/<case>/run-N.md` and `run-N.json`, and writing the same `aggregate-result.json` shape (each arm carries an `outputPath` to its run). One case format, two runners, so switching to native later needs no rewrite. `tests/eval-runner.test.mjs` drives the runner against a stub `claude` (`OMJ_EVAL_CLAUDE_BIN`), so the harness itself is under test without spending tokens.
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
| `frontend-fundamentals` | Writing, refactoring, or reviewing React components or hooks, before the answer | Supply readability, predictability, cohesion, coupling, and a11y guidance | Delegates only the specialist checks its references name |
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
---
/oh-my-joy:ralplan "add a rate limiter to the public API — 100 requests per minute per API key"
```

`prompt.md` accepts only the native keys (`schema_version`, `name`, `description`, `tags`, `plugins`, `runs`, `expected_outcome`, `model`, `max_turns`, `timeout_seconds`, `allowed_tools`, `append_system_prompt`, `env`); an unknown key is a load error in both runners. Workspace setup lives beside it:

```yaml
# evals/<case>/case.yaml
schema_version: "1.1"
name: spec-general-text
context:
  scaffold_script: scaffold.sh
```

```bash
# evals/<case>/scaffold.sh — runs in the empty workspace; fixtures are found from the script's own path
#!/usr/bin/env bash
set -euo pipefail
FIXTURES="$(cd "$(dirname "${BASH_SOURCE[0]}")/../fixtures" && pwd)"
cp -R "$FIXTURES/node-service/." .
```

A case tagged `fallback-only` depends on withholding `Agent`, which a native run always exposes; the native path skips it with a message (and exits 1 when it is the only case selected), so run it with `--fallback`.

`style-korean-answer` carries the answer style inline in `append_system_prompt`, because a workspace settings file does not select a plugin output style in an eval run; `tests/eval-cases.test.mjs` keeps that copy identical to `output-styles/oh-my-joy.md`.

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
tool: Bash
input_match: "git push"
max: 0
min: 0
---
```

`min` defaults to 1, so a never-called grader sets `min: 0`; it only means something for a tool the case lists, since an unlisted gated tool is withheld from the run.

```md
---
type: llm
---
The spec states verification commands taken from package.json scripts and lists at least three checkable acceptance criteria.
```

Grader types: `regex` (`pattern`, `flags`, `match: contains | not_contains | count:N`, `target: last_message | trace | files`), `tool_used` (`tool`, `input_match`, `min`, `max` — `max: 0` means "never called"), `tool_order` (`before`, `after`), `file_exists` (`path`), `llm` (`criteria`, `focus`), `baseline`. The native runner supports all of them; the fallback runner supports the first four plus `llm`.

## The loop

1. Before changing a command body, run its case once and keep the score: `npm run eval -- --case "review-*" --runs 1`. One run of one case is the unit of local work; the three-run suite is for a release.
2. Change the body. If the change alters what the command promises, add or update the case that observes that promise — a case is the executable version of the body's output contract.
3. Run again. Paste before and after into the PR's Test plan. A regression is a finding, not a formality.
4. Before a release, run the suite under a ceiling. Dispatching the `Evals` workflow by hand (`workflow_dispatch`) runs the native suite, when native eval is available to its API key (otherwise the runner falls back and skips the `ablation` cases), under `--max-cost-usd 45` — the `ablation` cases with and without the plugin, the rest against the pass threshold — and then, only when no case glob was given and that step passed, the `fallback-only` cases with `--fallback` under their own `--max-cost-usd 5`. The $45 ceiling fits one run per case, so dispatch it with `runs: 1` and run the three-run release suite locally with about three times the ceiling; three runs in the workflow would leave the cases the ceiling cannot cover unstarted and exit 2. Locally, `npm run eval` has no default ceiling and skips `fallback-only` cases, so pass `--max-cost-usd` yourself and run `npm run eval -- --fallback --tag fallback-only` as a second command. The workflow also declares `release: published`, but a Release that `release-tag.yml` creates with `GITHUB_TOKEN` does not start it, because events created with that token start no other workflow.

## Thresholds and cost

- `npm run eval` passes `--threshold 0.8`: a case scores below 0.8 when at least one grader in more than one of its three runs fails. A grader the judge could not score (no parseable verdict after two attempts) is excluded from the mean and counted in `aggregates.judgeFailures`, so harness flakiness shows up as a number instead of a zero.
- The fallback runner also reports run consistency. Each case carries `consistency: {runs, passedRuns, passAll, passAny}`, where a run passes when its own score reaches the threshold: `passAll` is pass^k (every run passed) and `passAny` is pass@k (at least one did). `aggregates.passAllRate` and `passAnyRate` average them over cases that started a run, and the console shows a `k-pass` column. A mean above the threshold can hide one failing run in three; pass^k exposes it. These numbers are informational — the exit code still follows the mean — they exist only in the fallback runner (the native delegation path writes its own aggregate), and they mean something only with two or more runs. When the cost ceiling stops a case early, k is the number of runs that started, next to `aggregates.ceilingHit`.
- Measured on 2026-09-07: one run of a spec case costs about $1.3–2.6, a review or verify case $0.9–1.3 (the CLI's own estimate; on a subscription login it counts against the plan's usage instead of a bill). Budget about $2 per case per run.
- `--max-cost-usd` is checked before a run starts, against the money already spent plus an estimate of the run (the case's previous run, else `--run-cost-estimate`, default 2). A run that started is always graded, judge calls included — an ungraded run is spend that bought nothing. When the budget is below one run's estimate, nothing starts and the runner says so; exit 2 in both cases, with whatever completed written out.
- `npm run eval` passes `--ablation none` natively for every case without the tag, so one local run costs one run, and `--ablation with-without` for cases tagged `ablation`, which also run without the plugin so the delta shows what OMJ adds. A slash-command case has no without-plugin arm to compare (the command does not exist there), so only plain-request cases carry the tag, and `tests/eval-cases.test.mjs` rejects a tagged case whose prompt starts with `/`. The fallback runner has no ablation arm. Inside one case the native ceiling cannot stop a run already in flight; across cases the runner's reservation keeps the total within `--max-cost-usd`.
- The Figma track has no case with a live Figma. Native mocks under `evals/mocks/` stand in for MCP servers the plugin itself declares, and OMJ declares none (no `.mcp.json`; Figma is the user's own integration), so a Figma mock cannot exist. The `sync-*` cases cover the path where Figma is unreachable instead: no invented drift, no claimed push, no edits to the store.
- The two-reviewer critique tier is exercised by hand before a release rather than by a case: it spawns two subagents, so one run costs roughly three runs' worth, and the case fixtures are small services whose plans take the self-check or one-critic tier (`ralplan-single-approval` accepts either and rejects an architect reader). Run ralplan on a task with a shape change or risk — for example one that adds a dependency — with `Agent` allowed, and read the result for `Critique: ready (independent: architect + critic`.
- Interactive loops are outside the single-prompt harness: the interview's question rounds (and its ambiguity floor) and the stretch after approval (the execution rules) cannot be driven by one `claude -p` prompt. Those are exercised by self-application — a release that changes them records a transcript of the new bodies in use in its PR — while the gates they leave behind (`## Critique`, the re-review table, the evidence kinds) have cases.

## Cases by command

| Command | Cases | What they pin |
| --- | --- | --- |
| `/oh-my-joy:ralplan` | `ralplan-single-approval`, `spec-general-text`, `spec-frontend-text`, `spec-critique-gate`, `spec-from-interview`, `ralplan-untrusted-comment` | an instruction embedded in external review text is rejected instead of widening delivery; the two spec shapes, the approved goal units and handoff sections, read-only, the `## Critique` section with its decision record and simulated tasks, and an interview's requirements taken as input without re-asking |
| `/oh-my-joy:ultragoal` | `ultragoal-requires-plan` | rejects unapproved raw work without code or ledger mutation |
| `/oh-my-joy:deep-interview` | `deep-interview-gate` | the suitability gate exits on concrete input without asking |
| `/oh-my-joy:review` | `review-mixed-diff`, `review-rerun-delta`, `review-verification-weakening`, `review-fail-closed` | both file classes with severities; a second pass reports prior findings first and only the delta; a skipped test and a loosened assertion are 🔴 `verification weakened`; `review-fail-closed` (fallback only, since a native run always exposes Agent) withholds Agent from a three-file diff and expects `Review: incomplete` with the session's own findings |
| `/oh-my-joy:verify` | `verify-evidence-mode` | evidence rows with exit codes and an evidence kind, and a failing verdict on red |
| `/oh-my-joy:ship` | `ship-on-shared-branch`, `ship-stops-on-red` | branches before committing, reuses an established base without a question, stops on failed verification |
| `/oh-my-joy:fix` | `fix-commit-stops-on-failed-recheck` | explicit `--commit` does not bypass a failed final recheck; no staging, branch, or commit mutation |
| `/oh-my-joy:setup` | `setup-check-readonly`, `setup-check-bare-project`, `setup-help`, `setup-neg-install-question` | `--check` reports the fixture's fe-context and token store, or their absence, without edits, installs, or questions (machine-dependent rows are graded for presence only); `--help` prints usage only; a plain install question is answered without starting setup |
| `/oh-my-joy:sync` | `sync-check-no-figma`, `sync-push-no-figma`, `sync-neg-token-question` | with Figma unreachable, `check` says the Figma side could not be read and reports nothing further, `push` claims nothing, and both give the desktop-app and active-tab guidance and leave the store untouched; a plain token question is answered without starting sync |
| `frontend-fundamentals` (skill) | `ff-*`: six `ff-fire`, two `ff-guard` | plain React refactor, review, and new-component requests in Korean and English trigger the skill, and a Node script or an API route handler does not; Δ against the no-plugin arm |
| answer style | `style-korean-answer` | fluent Korean, respects explanation-only scope without forced internal handoffs, no edits |

## The frontend-fundamentals trigger — 2026-09-20

Description 1.3.0 ("Guide React component and hook implementation or review for …") named a subject but no trigger. Under ablation the skill was listed in the with-arm session and fired in none of 18 should-trigger runs. Version 1.3.1 opens with the trigger and ends with when to apply it: "Use when writing, refactoring, or reviewing React components or hooks. Checks readability, predictability, cohesion, coupling, and accessibility before you answer." The fallback candidate (the same text plus a Korean parenthetical) was not run, because this one cleared the five-of-six adoption bar in the one-run pilot.

| `ff-*`, with-without, sonnet judge | 1.3.0 baseline, 3 runs (`2026-09-19T15-43-03-455Z`) | 1.3.1 pilot, 1 run (`2026-09-19T16-44-25-887Z`) | 1.3.1, 3 runs (`2026-09-19T16-50-37-637Z`) |
| --- | ---: | ---: | ---: |
| `ff-fire` runs where the skill fired (`display-fired`) | 0/18 | 5/6 | 17/18 |
| `ff-guard` runs where it fired (with-arm `Skill` calls) | 0/6 | 0/2 | 0/6 |
| Mean Δ over the six `ff-fire` cases (the 1.3.0 value comes from runs where the skill never loaded, so it is run-to-run noise) | +0.10 | +0.03 | +0.03 |
| `a11y-flagged-or-fixed` passes (both OrderCard cases, both arms) | 1/12 | 1/4 | 2/12 |
| Runs where a workflow command took over | 0 | 0 | 0 |
| Cost | $10.64 | $3.68 | $11.58 |

The trigger was the defect: 17 of 18 runs now load the skill, past the 12-of-18 target, and neither guard fires. Uplift is not shown yet. Per-case Δ runs from −0.28 to +0.17. On `ff-split-hook` two of three with-arm runs moved the logic into new `lib/` modules and failed `no-extra-layer` (one also failed `multiple-hooks` and `split-by-concern`), while every without-arm run passed it, and the with arm took more turns (15–17 against 9–11). The accessibility rubric still fails in most runs of both arms, but at least two failing with-arm answers on `ff-refactor-ordercard-en` flagged both defects, so the rubric's line between flagging and fixing with a product-bound alt needs tuning before it judges the skill body. The next levers are the skill body, its references, and that rubric, not the description.

The Codex catalog smoke for scenario 12 is `unobserved`: codex-cli 0.154.0 is installed on the measuring machine, but OMJ is not installed as a Codex plugin there (`codex plugin list --marketplace omj --json` lists nothing), and adding it to that Codex configuration was outside the authorized work. Run the scenario after `codex plugin add oh-my-joy@omj`.

## Enablement check

```bash
cd "$(mktemp -d)" && claude plugin eval
# "No eval cases found"                  → native runner available
# "plugin eval is currently in early access" → fallback runner is used
claude plugin eval . --max-cost-usd 0 --trust-plugin --no-publish
# validates every case and stops before the first run ($0); no ✗ lines means the suite loads
```

`--case __none__` stops earlier, before grader validation, so it misses a grader the loader rejects (for example `weight: 0`, which must be greater than 0).

## Running `claude plugin eval .` directly

`claude plugin eval .` with no options loads the plugin and every case and starts running them, but not the way `npm run eval` does. Observed with CLI 2.1.278:

- Every case runs with and without the plugin (the native default when a plugin is loaded), each for its declared `runs` (three for every case here), with no cost ceiling and publishing on.
- Every workspace is empty. The CLI runs a case's `scaffold_script` only with `--scaffold`, because it does not execute author-supplied bash by default, and no case key seeds a workspace otherwise, so each case warns that its scaffold is skipped and fixture-based cases can score low: a direct `ff-neg-*` run failed `task-done` in both cases because the file each prompt names was not there, and one bare `deep-interview-gate` run hit `max_turns`.
- Graders that observe Bash warn that they cannot pass without `--allow-tools Bash`.

The repository cannot change this: native eval has no suite-level defaults, and scaffolding, tool grants, the judge model, the threshold, the ablation mode, and publishing are all CLI flags. To run one case natively by hand, pass them yourself:

```bash
claude plugin eval . --case deep-interview-gate --scaffold --trust-plugin --no-publish \
  --allow-tools AskUserQuestion --threshold 0.8 --ablation none --max-cost-usd 3
# --allow-tools takes the gated tools the case lists (Bash patterns, Edit, Write, AskUserQuestion);
# use --ablation with-without for a case tagged `ablation`, and add --judge-model to change the judge
```

A tool grant applies to the whole run, and `--case` keeps only its last value, which is why the runner starts one native run per case. `review-fail-closed` is always red natively, because it depends on withholding `Agent`, which a native run always exposes. For everyday use run `npm run eval`: it passes the scaffold, the grants, the threshold, and the ablation mode per case, reserves one budget across parallel runs, and passes `--judge-model` only when you give it one.

On macOS, a native run executes Bash inside the OS sandbox, where `/usr/bin/git` (the Xcode `xcrun` shim) fails with exit 72 because it cannot write its cache (`couldn't create cache file … xcrun_db`). Cases that read a diff or commit then score low for environmental reasons. Put a standalone git first on `PATH` (for example Homebrew's) before trusting native scores of git-based cases, or run them with `--fallback`.

The new goal-state helper is also exercised through real child processes in `tests/goal-state.test.mjs`: resume, lock/CAS contention, corrupted state, failed or stale proof, review failure, and incomplete PR readback all block false completion. These tests do not claim a live GitHub delivery; that requires an explicitly authorized PR and readback.

## Workflow verification — 2026-09-08

- `npm test`: 509 passed, zero failed or skipped. Goal-state coverage includes 17 real child-process scenarios.
- `npm run validate-plugin`: passed the local Claude/Codex schema checks and both strict Claude manifest checks. The existing root `CLAUDE.md` warning remains accepted.
- Live Claude fallback runs: `ralplan-single-approval` passed 6/6 graders; `ultragoal-requires-plan` passed 5/5. Both exited 0 without timeout or source-write tool calls. The latter trace contains an actual `Skill(oh-my-joy:ralplan)` invocation and stops at final approval with automatic ultragoal continuation described.
- The admission case uses a one-line README task to isolate routing and approval. An earlier rate-limiter admission run invoked ralplan and its two reviewers but hit the 300-second limit; it is a failed run, not independent-review completion evidence.
- These single-prompt runs do not exercise the interactive approval-to-execution stretch, Codex live continuation, or real GitHub delivery. The ledger protocol is verified separately through subprocess tests; a release smoke must cover the remaining live paths.
