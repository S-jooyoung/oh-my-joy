# How OMJ evolves — the eval loop

OMJ's behavior is written in Markdown, so a "small wording change" in a command body is a behavior change. This document is the canon for measuring those changes instead of eyeballing them.

## What exists

- **`evals/`** — one directory per case: `prompt.md` (frontmatter + the prompt the case sends) and `graders/*.md` (one grader per file). Fixture workspaces live in `evals/fixtures/<name>/`; a case's `scaffold_script` copies the fixture into the sandbox before the run.
- **`npm run eval`** — runs the cases. It prefers Claude Code's native `claude plugin eval` (early access, enabled per organization; the runner detects "currently in early access" and falls back). The fallback, `scripts/eval-runner.mjs`, reads the same case files and drives `claude -p --plugin-dir . --output-format stream-json`, scoring the grader subset it understands (`regex`, `tool_used`, `file_exists`, `llm`) and writing the same `aggregate-result.json` shape. One case format, two runners, so switching to native later needs no rewrite.
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

1. Before changing a command body, run its cases and keep the score: `npm run eval -- --case "review-*"`.
2. Change the body. If the change alters what the command promises, add or update the case that observes that promise — a case is the executable version of the body's output contract.
3. Run again. Paste before and after into the PR's Test plan. A regression is a finding, not a formality.
4. On a release, the release job runs the whole suite with a cost ceiling and records the pass rate next to the content hash in the release notes.

## Thresholds and cost

- `npm run eval` passes `--threshold 0.8`: a case scores below 0.8 when at least one grader in more than one of its three runs fails.
- `--max-cost-usd` caps a run; the runner exits 2 and reports partial results when the ceiling is hit.
- With `--ablation with-without` (the native default when a plugin resolves) each case also runs without the plugin, and the delta is the number that shows what OMJ adds. The fallback runner has no ablation arm.
- Cases that need MCP servers (the Figma track) are second-phase: they wait for recorded mocks under `evals/mocks/`.

## Enablement check

```bash
cd "$(mktemp -d)" && claude plugin eval
# "No eval cases found"                  → native runner available
# "plugin eval is currently in early access" → fallback runner is used
```
