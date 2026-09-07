# CLAUDE.md — oh-my-joy (OMJ) repository operating rules

Rules for Claude sessions working in this repository. Keep it light every turn (<120 lines).

## What OMJ is

oh-my-joy (marketplace `omj`) is a standalone Claude Code plugin: **a general spec-first workflow spine with the code↔Figma frontend loop as a first-class mode.** Spine: `/oh-my-joy:deep-interview` (fuzzy) or `/oh-my-joy:spec` (concrete) → Plan approval → execution lane (inline · native `/goal` · native agent team) → `/oh-my-joy:review` → `/oh-my-joy:verify` → `/oh-my-joy:ship`. Frontend specialization: the Figma track and section walk in `spec`, the FF rubric in `review`, browser mode in `verify`, `/oh-my-joy:fix`, `/oh-my-joy:sync`. Mental model: **"enter once (spec or deep-interview), approve, and the approved plan's completion procedure runs review and verify; ship is yours."** Routing and the completion procedure are canonical in `docs/EXECUTION-HANDOFF.md`.

## Documentation discipline (top priority)

When adding or changing a feature, update all of the following **together** (changing only code without the docs is incomplete):

1. **README** (usage; **EN `README.md` + KO `README.ko.md` in sync**) — command/flag/behavior changes and the "How to use OMJ" scenario map.
2. **CHANGELOG** (entry) — 1 change = 1 entry.
3. **docs/PRINCIPLES.md** (how it works — English, canonical) — whenever a principle, design decision, or mental model changes, including its opening decision table.
4. **evals/** — a behavior change in a command body adds or updates an eval case (`docs/EVALS.md`).

Canonical facts (command names, the install string `/plugin install oh-my-joy@omj`) must **match across every doc and both README languages**. For narrative content, README (EN/KO in sync) is canonical; other docs summarize/link. README.md and README.ko.md keep the same structure.

## Command / agent / hook / style rules

- Single naming axis: every command uses an unprefixed kebab-case basename (`spec`, `review`, `ship`, …) — an `omj`-prefixed basename is blocked by tests. In docs and the selector, commands are **always written as `/oh-my-joy:<name>`** (bare slash notation is test-enforced).
- Commands (8): `/oh-my-joy:spec` (Plan primer: Figma track with section walk, frontend text, general text, or an interview's requirements; critique gate — self-check always, two `critic` readings for non-trivial plans; lane selector; completion procedure) · `/oh-my-joy:deep-interview` (requirement interview with an ambiguity floor → exit bridge: hand to `spec` (default), plan directly for small work, or research first) · `/oh-my-joy:review` (diff review — FF rubric for frontend files, correctness/simplicity/consistency/tests for the rest; independent `critic` pass on non-trivial diffs; re-review passes report the delta; report only) · `/oh-my-joy:verify` (browser mode with a route, evidence mode without; report only) · `/oh-my-joy:fix` (visual defect loop, active) · `/oh-my-joy:sync` (token code↔Figma, interactive, active) · `/oh-my-joy:ship` (verification commands → commit → push → PR; the one manual last step) · `/oh-my-joy:setup` (dependency doctor + scaffolding, all opt-in). (v1.1: `/oh-my-joy:push` · `/oh-my-joy:ds-spec`.)
- New command = `commands/<name>.md` + frontmatter `description`, `argument-hint`, `allowed-tools` (**least privilege**). Two test-enforced tiers: **zero-bash read-only** (spec, deep-interview — no write tools, no Bash) / **report-only** (review, verify — source-non-mutating, observation-scoped Bash). `Agent` is allowed only on spec and review, only for `critic`, and the test pins that the agent declares no write tools. `ship` may pre-approve only `git`/`gh`/`npx tsc` and never a test runner (the permission prompt on a verification command is the evidence's confirmation point). Frontmatter `description`/`argument-hint` are English-first; Korean trigger examples may stay in parentheses — the language purity check covers bodies only.
- **Never declare a tool the body's procedure does not call.** Narrow Bash to the smallest runnable prefix (`Bash(npm i -g playwright-cli:*)`, not `Bash(npm:*)`). Declare MCP tools with the plugin prefix **and** the bare server variant side by side. Both are pinned by `tests/plugin-manifest.test.mjs`.
- **Prompt style** (`tests/prompt-style.test.mjs`): bodies follow the Anthropic prompting guide — state what to do and why, no shouted imperatives (MUST/NEVER/ALWAYS/…), at most 20 bold markers, no callout glyphs (the 🔴🟡🟢 severity triad excepted), no principle-number pointers, usage examples inside `<example>` tags. Bodies keep a compact skeleton: one goal sentence, numbered phases, rules with their reasons, an output contract.
- **Agents** (`agents/*.md`, exactly 3): `implementer` (approved spec required; frontend or general mode; inline executor and the teammate type for every Dispatch row — owns only its row's files, classifies blockers, reports evidence) · `design-qa` (inspect-only mechanical gate) · `critic` (read-only reviewer spawned by `spec` and `review` in a fresh context; architect or critic lens; tools exactly `Read, Grep, Glob`, test-pinned). No `model` field (inherits). Agents are never listed as lanes. Rename grace: `figma-implementer` stays in the README migration table for one minor release.
- **Surface tiers** (README canon): you type `deep-interview` (fuzzy only) → `spec` → approve → `ship`; the plan runs `review` → `verify` → `fix`; `sync` and `setup` are occasional; agents are internal and never typed. Keep every doc telling that story.
- **Output style** (`output-styles/oh-my-joy.md`): natural answers in the user's language (Korean rules ported from fluent-korean, credited in `NOTICE.md`), learner-friendly explanations, next-step pointer. `keep-coding-instructions: true`, never `force-for-plugin` — selected by the user via `/oh-my-joy:setup` or `/config` (test-enforced). Korean appears only inside its `<example>` blocks.
- **Hooks**: never ship `hooks/hooks.json` (auto-firing in every repo is the rejected alternative). Canonical scripts live in `templates/hooks/*.mjs`; `/oh-my-joy:setup` copy-installs them (opt-in); they no-op without an fe-context declaration.
- **HUD** (`hud/`): vendored statusLine bundle — never hand-edit `hud/vendor/hud/index.js`; regenerate per `hud/README.md`. Copy-installed user-globally by setup. Attribution: `NOTICE.md`.
- The SoT for behavior is each `commands/*.md` body. Read that file before writing code or docs about it.
- **Test gotchas**: `npm test` is scoped to `tests/*.test.mjs tests/hooks/*.test.mjs` on purpose — `evals/fixtures/*/test/` holds intentionally failing suites, so never widen it to bare `node --test`. The docs tests enumerate **tracked** files (`git ls-files`), so `git add` new markdown before trusting a green `npm test`. The legacy-token guard matches `\bomj-`, so avoid `omj-` inside heading anchors (`#how-omj-evolves` failed it). When adding a CHANGELOG entry, anchor the edit on the `## [Unreleased]` block — right after a cut its sections are empty and a search for `### Changed` lands in the just-released section (it happened in 0.8.1). `npm run eval` drives real Claude sessions: run only the changed case with `--runs 1` (≈ $2 of usage; a spec case with the independent critique ≈ $7 because two `critic` subagents read the workspace twice), never the whole suite per change; each run's output lands in `evals/results/<stamp>/<case>/run-N.md`, so read it before re-running a scenario for evidence.

## Core design principles (summary — canonical: docs/PRINCIPLES.md)

- **Plan-native primer**: `spec` and `deep-interview` are read-only; they author the Plan and stop. Nothing runs before approval.
- **Critique before consent**: `spec` challenges its draft — self-check always (decision record, simulated tasks, `ready` verdict), plus two `critic` agents in fresh contexts for non-trivial plans (architect + critic lens, delta re-review, at most two passes, then one question for what stays open) — and appends `## Critique` before the lane section. Independence comes from a fresh context, never from another command. Approval is consent, not a feasibility check.
- **Approved plan carries the completion procedure**: after approval the session implements, then invokes `review` and `verify` (and the `fix` loop for frontend) as skills — not implicit, because the user approved that section. `ship` is always explicit (push/PR are visible to others).
- **Evidence rule**: "done" needs `command · exit code · summary` plus the evidence kind (test report, command replay, browser capture). `verify` (evidence mode), `ship`, and agent-team teammates all record it; verification commands are never pre-approved.
- **Execution asks nothing**: between approval and the report the session asks no questions; blockers are `resolvable` (three approaches first) or `human-only` (stop, say what the user must do). Canonical in `docs/EXECUTION-HANDOFF.md`, test-pinned.
- **Three lanes, native**: inline · `/goal` · native Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; degrades to subagents, then inline). OMJ owns the dispatch contract (Section | Figma node | Teammate | Owns files | Verify command), not a runtime.
- **Spec format**: uSpec sections + FF 4 criteria + a11y for frontend; goal/constraints/acceptance/verification commands for general work. Large Figma frames are read section by section.
- **code↔Figma token sync**: code is the default SoT; on conflict the user picks the direction.
- **Minimal bundling / borrow methodology, not surface**: one bundled skill (FF); vercel skills referenced; external methodologies absorbed as self-authored rewrites credited in `NOTICE.md`; rejected borrowings recorded in PRINCIPLES.
- **Graceful degradation**: a missing figma/context7/playwright-cli/Agent Teams flag is a skip plus guidance, never an error.
- **Measure, don't eyeball**: `evals/` (native `claude plugin eval`, `scripts/eval-runner.mjs` fallback) and the always-on token budget (`tests/token-budget.test.mjs`).

## Git / commits

- **No direct commits to main** — branch and open a PR to main. Release tags attach to the main commit after merge.
- Conventional commits: `<type>(<scope>): <subject>` (feat/fix/chore/docs/refactor/test).
- **Release**: run `/release` (repo-local `.claude/commands/release.md` — cut → PR → merge → tag wait → local apply, one confirmation); never hand-edit version strings or run `git tag`.
- **Rename grace**: a renamed or retired command stays in the README migration table and CHANGELOG for at least one minor release (v0.8.0: `ff-review` → `review`; `ralplan`, `goal-loop` retired).
- ❌ **AI signatures, `Co-Authored-By: Claude`, "Generated with Claude Code" — never.**
- Write in English. Keep it concise.
- PRs: `pr-triage.yml` auto-assigns the maintainer and syncs the type label; still pass `--assignee`/`--label` explicitly.

## Meta: maintaining this file

- Update when commands/principles/integrations change. One concept = one line, **stay <120 lines**.
- No self-evident or general dev knowledge. Detailed principles live in docs/PRINCIPLES.md.
