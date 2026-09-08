# CLAUDE.md — oh-my-joy (OMJ) repository operating rules

Rules for Claude sessions working in this repository. Keep it light every turn (<120 lines).

## What OMJ is

oh-my-joy (marketplace `omj`) is a standalone Claude Code and Codex plugin: **a general spec-first workflow spine with the code↔Figma frontend loop as a first-class mode.** Claude exposes `/oh-my-joy:<name>` commands; Codex exposes matching `$oh-my-joy:<name>` skills. Spine: `deep-interview` (fuzzy) → `ralplan` → final Plan approval → `ultragoal` (native continuation, goal records, review, verify, resume). `spec` is a compatibility alias. New PR creation stays in `ship`; approved existing-PR review delivery belongs to ultragoal. Mental model: **"enter once, approve once, and ultragoal completes and records the approved work."** Provider mapping, routing, and completion are canonical in `docs/EXECUTION-HANDOFF.md`.

## Documentation discipline (top priority)

When adding or changing a feature, update all of the following **together** (changing only code without the docs is incomplete):

1. **README** (usage; **EN `README.md` + KO `README.ko.md` in sync**) — command/flag/behavior changes and the "How to use OMJ" scenario map.
2. **CHANGELOG** (entry) — 1 change = 1 entry.
3. **docs/PRINCIPLES.md** (how it works — English, canonical) — whenever a principle, design decision, or mental model changes, including its opening decision table.
4. **evals/** — a behavior change in a command body adds or updates an eval case (`docs/EVALS.md`).

Canonical facts (workflow names and both hosts' `oh-my-joy@omj` install instructions) must **match across every doc and both README languages**. For narrative content, README (EN/KO in sync) is canonical; other docs summarize/link. README.md and README.ko.md keep the same structure.

## Command / agent / hook / style rules

- Single naming axis: every command uses an unprefixed kebab-case basename (`ralplan`, `review`, `ship`, …) — an `omj`-prefixed basename is blocked by tests. In docs and the selector, commands are **always written as `/oh-my-joy:<name>`** (bare slash notation is test-enforced).
- Commands (10 entry points including the compatibility alias): `/oh-my-joy:ralplan` (Plan primer: Figma track with section walk, frontend text, general text, or an interview's requirements; critique gate — self-check always, two `critic` readings for non-trivial plans; goal units; authorized delivery; automatic ultragoal handoff) · `/oh-my-joy:deep-interview` (requirement interview with an ambiguity floor → exit bridge: automatically hand to `ralplan`, retaining research prerequisites) · `/oh-my-joy:review` (diff review — FF rubric for frontend files, correctness/simplicity/consistency/tests for the rest; independent `critic` pass on non-trivial diffs; re-review passes report the delta; report only) · `/oh-my-joy:verify` (browser mode with a route, evidence mode without; report only) · `/oh-my-joy:fix` (visual defect loop, active) · `/oh-my-joy:sync` (token code↔Figma, interactive, active) · `/oh-my-joy:ship` (verification commands → commit → push → PR; the one manual last step) · `/oh-my-joy:ultragoal` (approved goal execution and resume) · `/oh-my-joy:spec` (ralplan compatibility alias) · `/oh-my-joy:setup` (dependency doctor + scaffolding, all opt-in). (v1.1: `/oh-my-joy:push` · `/oh-my-joy:ds-spec`.)
- New command = `commands/<name>.md` + frontmatter `description`, `argument-hint`, `allowed-tools` (**least privilege**). Two test-enforced tiers: **zero-bash read-only** (spec alias, deep-interview — no write tools, no Bash) / **report-only** (ralplan, review, verify — source-non-mutating, observation-scoped Bash). `Agent` on read-only commands is allowed only on ralplan and review, only for `critic`; ultragoal may dispatch implementation roles, and the test pins that the agent declares no write tools. `ship` may pre-approve only `git`/`gh`/`npx tsc` and never a test runner (the permission prompt on a verification command is the evidence's confirmation point). Frontmatter `description`/`argument-hint` are English-first; Korean trigger examples may stay in parentheses — the language purity check covers bodies only.
- **Never declare a tool the body's procedure does not call.** Narrow Bash to the smallest runnable prefix (`Bash(npm i -g playwright-cli:*)`, not `Bash(npm:*)`). Declare MCP tools with the plugin prefix **and** the bare server variant side by side. Both are pinned by `tests/plugin-manifest.test.mjs`.
- **Prompt style** (`tests/prompt-style.test.mjs`): bodies follow the Anthropic prompting guide — state what to do and why, no shouted imperatives (MUST/NEVER/ALWAYS/…), at most 20 bold markers, no callout glyphs (the 🔴🟡🟢 severity triad excepted), no principle-number pointers, usage examples inside `<example>` tags. Bodies keep a compact skeleton: one goal sentence, numbered phases, rules with their reasons, an output contract.
- **Agents** (`agents/*.md`, exactly 3): `implementer` (approved spec required; frontend or general mode; inline executor and the teammate type for every Dispatch row — owns only its row's files, classifies blockers, reports evidence) · `design-qa` (inspect-only mechanical gate) · `critic` (read-only reviewer spawned by `ralplan` and `review` in a fresh context; architect or critic lens; tools exactly `Read, Grep, Glob`, test-pinned). No `model` field (inherits). Agents are never listed as lanes. Rename grace: `figma-implementer` stays in the README migration table for one minor release.
- **Surface tiers** (README canon): you enter `deep-interview` (fuzzy only) → `ralplan` → approve → `ultragoal`; `spec` remains a compatible alias; the plan runs `review` → `verify` → `fix`; `sync` and `setup` are occasional; agents/internal role skills are never normal entry points. Keep every doc telling that story for both hosts.
- **Output style** (`output-styles/oh-my-joy.md`): natural answers in the user's language (Korean rules ported from fluent-korean, credited in `NOTICE.md`), learner-friendly explanations, next-step pointer. `keep-coding-instructions: true`, never `force-for-plugin` — selected by the user via `/oh-my-joy:setup` or `/config` (test-enforced). Korean appears only inside its `<example>` blocks.
- **Hooks**: never ship `hooks/hooks.json` (auto-firing in every repo is the rejected alternative). Canonical scripts live in `templates/hooks/*.mjs`; `/oh-my-joy:setup` copy-installs them (opt-in); they no-op without an fe-context declaration.
- **HUD** (`hud/`): vendored statusLine bundle — never hand-edit `hud/vendor/hud/index.js`; regenerate per `hud/README.md`. Copy-installed user-globally by setup. Attribution: `NOTICE.md`.
- The SoT for workflow behavior is the matching Claude command plus the provider-neutral contracts in `docs/`; each Codex `skills/<name>/SKILL.md` is the host adapter. Keep the two surfaces behaviorally aligned without copying Claude-only tool names into Codex skills. Codex requires the canonical `skills/` tree and model-discoverable skills, while Claude keeps the matching `commands/*.md` files as its authoritative workflow contracts.
- **Test gotchas**: `npm test` is scoped to `tests/*.test.mjs tests/hooks/*.test.mjs` on purpose — `evals/fixtures/*/test/` holds intentionally failing suites, so never widen it to bare `node --test`. The docs tests enumerate **tracked** files (`git ls-files`), so `git add` new markdown before trusting a green `npm test`. The legacy-token guard matches `\bomj-`, so avoid `omj-` inside heading anchors (`#how-omj-evolves` failed it). When adding a CHANGELOG entry, anchor the edit on the `## [Unreleased]` block — right after a cut its sections are empty and a search for `### Changed` lands in the just-released section (it happened in 0.8.1). `npm run eval` drives real Claude sessions: run only the changed case with `--runs 1` (≈ $2 of usage; a spec case with the independent critique ≈ $7 because two `critic` subagents read the workspace twice), never the whole suite per change; each run's output lands in `evals/results/<stamp>/<case>/run-N.md`, so read it before re-running a scenario for evidence.

## Core design principles (summary — canonical: docs/PRINCIPLES.md)

- **Plan-native primer**: `ralplan` and `deep-interview` are read-only; the interview automatically hands requirements to ralplan, which presents the final Plan. Nothing runs before approval.
- **Critique before consent**: `ralplan` challenges its draft — self-check always (decision record, simulated tasks, `ready` verdict), plus two `critic` agents in fresh contexts for non-trivial plans (architect + critic lens, delta re-review, at most two passes, then one question for what stays open) — and appends `## Critique` before the final approval gate. Independence comes from a fresh context, never from another command. Approval is consent, not a feasibility check.
- **Approved plan carries the completion procedure**: after approval the session implements, then invokes `review` and `verify` (and the `fix` loop for frontend) as skills — not implicit, because the user approved that section. `ship` is explicit for new PRs. Existing PR commit/push/replies run only when included in the approved review-response plan.
- **Ultragoal records**: `.omj/goals/<slug>/` stores the immutable approved brief, versioned goals, append-only ledger, and evidence. Only the leader uses `scripts/goal-state.mjs`; subprocess checks record actual exit codes and current workspace fingerprints. Final close requires fresh final proof and independent review, plus every required PR reply/readback. A native goal completion alone is insufficient.
- **Resume**: same checkout and approved scope; preserve unrelated edits and native goals. Locks and expected revisions reject concurrent writers. Interrupted external sends are reconciled before retry. No background-running promise when a native continuation surface is absent.
- **Evidence rule**: "done" needs `command · exit code · summary` plus the evidence kind (test report, command replay, browser capture). `verify` (evidence mode), `ship`, and agent-team teammates all record it; verification commands are never pre-approved.
- **Execution asks nothing**: between approval and the report the session asks no questions; blockers are `resolvable` (three approaches first) or `human-only` (stop, say what the user must do). Canonical in `docs/EXECUTION-HANDOFF.md`, test-pinned.
- **Three lanes, native**: inline · persistent goal · native parallel agents. Claude maps these to `/goal` and Agent Teams; Codex maps them to goals and native subagents. Both degrade to inline. OMJ owns the dispatch contract and a dependency-free goal-state helper, while the host owns continuous execution. No custom stop hook or external orchestrator is required.
- **Spec format**: uSpec sections + FF 4 criteria + a11y for frontend; goal/constraints/acceptance/verification commands for general work. Large Figma frames are read section by section.
- **code↔Figma token sync**: code is the default SoT; on conflict the user picks the direction.
- **Minimal bundling / borrow methodology, not surface**: one shared FF skill, ten Codex workflow adapters, and three Codex internal role adapters; external methodologies are credited in `NOTICE.md`; rejected borrowings are recorded in PRINCIPLES.
- **Graceful degradation**: a missing figma/context7/playwright-cli/Agent Teams flag is a skip plus guidance, never an error.
- **Measure, don't eyeball**: `evals/` (native `claude plugin eval`, `scripts/eval-runner.mjs` fallback) and the always-on token budget (`tests/token-budget.test.mjs`).

## Git / commits

- **No direct commits to main** — branch and open a PR to main. Release tags attach to the main commit after merge.
- Conventional commits: `<type>(<scope>): <subject>` (feat/fix/chore/docs/refactor/test).
- **Release**: run `/release` (repo-local `.claude/commands/release.md` — cut → PR → merge → tag wait → local apply, one confirmation); never hand-edit version strings or run `git tag`.
- **Rename grace**: `spec` remains an alias for `ralplan`; historical `goal-loop` maps to `ultragoal` without silently converting old state. Keep prior names in the migration table and CHANGELOG.
- ❌ **AI signatures, `Co-Authored-By: Claude`, "Generated with Claude Code" — never.**
- Write in English. Keep it concise.
- PRs: `pr-triage.yml` auto-assigns the maintainer and syncs the type label; still pass `--assignee`/`--label` explicitly.

## Meta: maintaining this file

- Update when commands/principles/integrations change. One concept = one line, **stay <120 lines**.
- No self-evident or general dev knowledge. Detailed principles live in docs/PRINCIPLES.md.
