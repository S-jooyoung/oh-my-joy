# Changelog

All notable changes to this project are recorded in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning adheres to [Semantic Versioning](https://semver.org/).

History prior to 0.6.0 is preserved in Korean.

## [Unreleased]

### Added

- `/oh-my-joy:ship` — the explicit last step of every flow: runs the project's verification commands (each must exit 0), commits on a branch with the project's conventions, pushes, and opens the PR with the evidence table in its body. Pre-approves only `git`/`gh`/`npx tsc`; test runners go through the permission prompt on purpose (pinned by `tests/plugin-manifest.test.mjs`)
- `/oh-my-joy:review` general mode — files outside the frontend set are reviewed for correctness, simplicity, consistency with surrounding code, and test coverage; an approved spec's acceptance criteria are checked against the diff; a diff with no frontend files is no longer "not a review target"
- `/oh-my-joy:verify` evidence mode — without a route it runs the project's verification commands (spec → `verifyCommands:` → `package.json` scripts) and records `command · exit code · summary`
- `/oh-my-joy:spec` general track (goal / constraints / target files / acceptance criteria / verification commands / non-goals) for non-frontend work, and a routing line to `/oh-my-joy:deep-interview` when the text carries no verifiable target
- `/oh-my-joy:spec` section walk — a Figma frame with three or more top-level sections is read section by section (`get_metadata` first, one `get_design_context` per section) and yields a per-section spec plus a Dispatch table (`Section | Figma node | Teammate | Owns files | Verify command`); more than eight sections proposes a split
- Agent-team lane on native Agent Teams — `docs/EXECUTION-HANDOFF.md` records the enable flag, the dispatch contract, the copyable spawn line, `verify` as the barrier, and the fallback chain (agent team → subagents → inline); `figma-implementer` gains a teammate contract (own only the row's files, report completion with evidence)
- Completion procedure — every approved spec ends with `implement → /oh-my-joy:review → /oh-my-joy:verify → (frontend) /oh-my-joy:fix loop → report with evidence`, which the session follows after approval; `/oh-my-joy:ship` stays manual
- `output-styles/oh-my-joy.md` — an opt-in answer style: natural answers composed in the reader's language (Korean rules adapted from fluent-korean, credited in `NOTICE.md`), explanations a junior developer can follow, and a next-step pointer; `keep-coding-instructions: true`, never `force-for-plugin` (pinned by tests). `/oh-my-joy:setup` offers to select it
- `verifyCommands:` in `.omj/fe-context.md` — the project's own definition of "proven", read by `verify` (evidence mode) and `ship`; `/oh-my-joy:setup` scaffolds it from `package.json` scripts as comments
- `/oh-my-joy:setup` inspects the Agent Teams flag and the answer style and offers both as opt-in installs
- `tests/prompt-style.test.mjs` — every command, agent, skill, and output-style body is checked against the Anthropic prompting guide: no shouted imperatives, at most 20 bold markers, no callout glyphs, no principle-number pointers, usage examples inside `<example>` tags
- `tests/token-budget.test.mjs` — the always-on description cost of all plugin surfaces is a ratcheted budget
- `evals/` — behavioral eval cases per command for native `claude plugin eval` (early access), with `scripts/eval-runner.mjs` as the `claude -p` fallback and `npm run eval` choosing between them; `docs/EVALS.md` is the evolution loop (a behavior change adds or updates a case; scores go into the PR's test plan)
- Repo-local `/release` command (`.claude/commands/release.md`, maintainers only) — cut → release PR → CI wait → merge → tag/Release wait → local apply, with one confirmation; `scripts/release.mjs next` infers the next version from `[Unreleased]` (removals/changes/deprecations → minor, otherwise patch; major only by `--bump major`)
- README (EN/KO) "How to use OMJ" — six scenarios with the exact command sequence each, and "How OMJ evolves"
- OMJ HUD statusline: a vendored, self-contained HUD bundle under `hud/` (upstream attribution and MIT license text in `NOTICE.md`), installed opt-in by `/oh-my-joy:setup` as a copy at `~/.claude/omj-hud/` with a registered `statusLine` — the same copy-not-reference model as the token-guard hooks
- Deterministic plugin-surface inventory: `scripts/generate-inventory.mjs` hashes the tracked tree (or an installed copy via `--dir`) into a single sha256; each GitHub Release now records that hash in its notes, and a post-publish `verify-release` job re-derives the tag tree's hash and fails on divergence (`.github/workflows/release-tag.yml`)
- Hook-template convention suite `tests/hooks/hook-conventions.test.mjs` — every shipped hook must declare its risk class, and advisory hooks must guard crashes with a fail-open exit 0
- Table-hygiene docs check — blank placeholder table cells (empty inline-code cells left by unfinished edits) now fail `tests/docs-consistency.test.mjs`

### Changed

- OMJ is now a general spec-first workflow spine with the code↔Figma loop as a first-class mode: `deep-interview` or `spec` → approval → lane (inline · `/goal` · agent team) → `review` → `verify` → `ship`, for frontend and non-frontend work alike (README, `docs/PRINCIPLES.md` ①②⑤⑦⑧⑫, `CLAUDE.md`)
- Execution lanes are three and all native — inline, `/goal`, agent team; the routing document also owns the completion procedure
- `/oh-my-joy:ff-review` is renamed `/oh-my-joy:review` (the old name stays in the README migration table for one minor release)
- Every command, agent, and skill body was rewritten to the Anthropic prompting guide: rules state what to do and why, shouted imperatives and warning glyphs are gone, usage examples sit in `<example>` tags; behavior is unchanged except where this changelog says otherwise
- `/oh-my-joy:deep-interview` closes with the same execution-lane and completion-procedure sections as `spec`
- `frontend-fundamentals` skill 1.3.0 — routing text restyled, companion commands updated to `review`, `verifyCommands` documented in `references/fe-acceptance.md`
- `tests/standalone.test.mjs` pins three lanes, the Agent Teams flag, the fallback chain, and the completion procedure instead of the retired fourth lane; `tests/plugin-manifest.test.mjs` pins exactly two agents, the `ship` pre-approval surface, and the output-style frontmatter; `tests/docs-consistency.test.mjs` anchors the retired names to the migration tables and exempts `evals/` and output-style examples from the English-only check
- Token-guard hook templates declare `Risk class: advisory` and exit 0 even on an unexpected crash (fail-open) — a hook defect can never block a session
- `/oh-my-joy:goal-loop` completion evidence now requires `verification.exitCode` to be the integer `0`; a self-reported "passed" string alone no longer completes a goal (in-flight loops add the field on their next complete transition)

### Deprecated

- The command name `ff-review` — use `/oh-my-joy:review`; the alias row stays in the README migration table until the next minor release

### Removed

- `/oh-my-joy:ralplan` and the `plan-critic` agent — consensus review overlapped with native Plan mode; fuzzy work goes to `/oh-my-joy:deep-interview` before the spec instead
- `/oh-my-joy:goal-loop`, `scripts/goal-state.mjs`, and `tests/goal-state.test.mjs` — the durable lane overlapped with `/goal` and Plan mode; its evidence rule (no completion without `command · exit code · summary`) lives on in `verify`, `ship`, and the teammate contract, and `.omj/goals/` is no longer written
- The "no FE changes → not a review target" rule of the diff review

### Fixed

### Security

## [0.7.1] - 2026-08-18

### Added

### Changed
- **README (EN/KO) gains an upgrade pointer and a comprehension pass** — a migration table next to the Updates note (old `omj-*` names → `/oh-my-joy:*`, what did *not* change, the `ds-spec` rename trap) guarded by a new anti-vacuity test; FF and uSpec expanded on first use (Toss frontend-fundamentals · Uber's design-spec taxonomy); a Figma-link example in Quick Start and a Figma-track bridge in the walkthrough; a "What OMJ writes into your repo" section; the hexagon legend, the deep-interview paste bridge, the agent-team launch surface, and the `JOY_BASE_URL` precedence (including the inline-prefix trap) clarified.

### Deprecated

### Removed

### Fixed
- **Manifest descriptions no longer promise auto-chaining** — `marketplace.json` advertised that the plugin "chains" implementation, verification, and token sync after approval, contradicting the README's core promise that verification never runs implicitly; both manifest descriptions are rewritten (each step runs on your invocation) and now also cover the general-purpose commands (deep-interview, goal-loop, ralplan). keywords/tags stay FE-focused by decision — the search identity is the FE loop.
- **Doc facts re-anchored to their sources of truth** — the `fix` command-table row now says "screenshot and/or complaint" with the route required (matching `commands/fix.md`); `docs/design-tokens.md` is labeled as a consuming-project artifact and `figma-fidelity.md` becomes a relative link to the bundled FF reference (now covered by the link-integrity test); plan-critic restored to the PRINCIPLES bundled-agent enumeration; the `/plugin update oh-my-joy@omj` string is unified across SECURITY.md and the bug template and pinned by a new manifest-assembled guard test.

### Security

## [0.7.0] - 2026-08-18

### Added
- Repo-local `release-checklist` skill (`.claude/skills/`, maintainers only, not shipped to users): pre-flight gates, the release cut, the local apply loop for `directory`-source marketplaces, and a drift check that separates a stale install from a stale session.

### Changed
- **BREAKING: single `/oh-my-joy:` namespace for every command** — `/omj`→`/oh-my-joy:spec`, `/omj-verify`→`/oh-my-joy:verify`, `/omj-fix`→`/oh-my-joy:fix`, `/omj-sync`→`/oh-my-joy:sync`, `/omj-setup`→`/oh-my-joy:setup` (already canonical: ff-review, deep-interview, goal-loop, ralplan). The v0.6.0 two-axis naming rule is retired: the plugin-name namespace already brands the command, so an in-name prefix duplicated it in the canonical form. Announced v1.1 names move too: `/omj-push`→`/oh-my-joy:push`, `/omj-spec`→`/oh-my-joy:ds-spec`. Auto-trigger routing (Figma link → spec, screenshot+complaint → fix) is description-based and unaffected. Non-command literals are intentionally unchanged: the `.omj/` state directory, the `oh-my-joy@omj` install string, the `[omj:*]` hook output prefixes, and the `omj-allow-color` suppression literal. Tests swap the two-axis assertion for a single-axis guard plus a negative legacy-token scan (CHANGELOG exempt as history).
- **Execution lanes rebased on a runtime-free world** — the lane set is now inline (default) · native `/goal` (in-session iteration) · native agent team (parallel subagents) · `/oh-my-joy:goal-loop` (durable, evidence-gated); `docs/EXECUTION-HANDOFF.md` is rewritten around the four lanes and absorbs the gate-orthogonality narrative from the removed `docs/OMC-INTEGRATION.md`. PRINCIPLES ⑦ is rewritten as spec-first lane handoff, and the standalone test suite now bans external-orchestrator mentions outside CHANGELOG/NOTICE instead of requiring per-mention fallbacks.
- **README (EN/KO) restructured around a "Recommended workflow"** — tutorial first (Quick Start → 4 recommended steps with each step's "when" folded into its line → a "What a Figma link turns into" mechanism section → a full session walkthrough), reference (command table) after, design notes last. A single boundary paragraph now states what never happens automatically (the primer writes no code; ExitPlanMode approval is where execution starts). The diagram is redrawn around the recommended spine with the two decision points (execution lane, ExitPlanMode) as hexagons; the read-only dash encoding is retired — the command table's privilege note owns that fact.

### Deprecated

### Removed
- **BREAKING: OMC/OMX integration and `/omj-start`** — the external-orchestrator lane tables, `docs/OMC-INTEGRATION.md`, and the handoff command are removed; the spec's execution-lane section now prints the one copyable action itself, and legacy Korean selector-label recognition retires with the handoff command.

### Fixed

### Security

## [0.6.0] - 2026-08-15

### Added

- **`npm run validate-plugin` (`scripts/validate-plugin.mjs`)** — manifest and frontmatter conformance against the official plugin spec, in two layers: a built-in schema check that always runs (field whitelists taken from the official reference, unknown keys are errors because the runtime silently ignores them), plus `claude plugin validate --strict` when the CLI is on PATH. Catches what the existing suite could not: unknown manifest fields, a marketplace entry whose version disagrees with plugin.json, `permissionMode`/`hooks`/`mcpServers` on a plugin-shipped agent (a spec-level security restriction), a skill directory without SKILL.md, and a mistyped frontmatter key. Exactly one warning is accepted — root `CLAUDE.md` is contributor documentation, not shipped plugin context — and it is matched on its exact text so any other warning still fails. Wired into CI; mutation-verified against five reintroduced defects.
- **Behavioral tests for the validator (`tests/validate-plugin.test.mjs`, 18 cases)** — a validator never shown a broken manifest is indistinguishable from one that always exits 0, so each check is now exercised against a fixture violating exactly it (unknown fields on all three manifest levels, non-kebab-case name, missing owner, version disagreement, unresolvable install pair, missing source path, mistyped/absent command frontmatter, `permissionMode`/`mcpServers` on a plugin-shipped agent, a skill directory without SKILL.md, a shipped hooks.json). `validate-plugin.mjs` gains `--root` and `--skip-cli` to make fixture validation possible; neither is used in normal operation.
- **CI syntax check + `.github/dependabot.yml`** — CI parses every committed `.mjs` (`node --check`) and every committed `.json`, catching the class a linter would catch here: a syntax error in a file no test imports. ESLint/TypeScript were rejected — they would add the first dependency to a repo whose premise is having none, and would fail `tests/standalone.test.mjs`. Dependabot watches only `github-actions` (there is no npm ecosystem to watch), weekly, grouped into one PR, capped at 2 open — a queue of unreviewed update PRs is worse for a single maintainer than no updates.
- **`SECURITY.md` + issue templates (bug / feature / config)** — private vulnerability reporting with an explicit scope statement: over-broad `allowed-tools` grants, prompt content that could steer Claude into destructive or exfiltrating actions, and shell injection in `scripts/`/`templates/hooks/` are in scope, while the permission prompt itself is the design, not a bug. The bug template asks for "what you expected **and where that is documented**", matching a repo whose docs are the spec.
- **README (EN/KO) contributing and license sections** — the two READMEs described what the plugin does and never how to work on it: clone → `npm test` → `npm run validate-plugin`, how to install a local clone as a real plugin, the two rules a first PR trips over, and pointers to CONTRIBUTING/SECURITY/NOTICE.

- **Standalone invariants (`tests/standalone.test.mjs`)** — "OMJ runs fully without OMC/OMX" was asserted only in prose, so nothing failed a build if a hard runtime dependency crept back in. Nine structural checks now gate it: package.json stays dependency-free with no committed lockfile, every shipped `.mjs` imports only `node:*` built-ins or relative paths, `docs/EXECUTION-HANDOFF.md` keeps its `No runtime` row routing durable work to `/oh-my-joy:goal-loop` and consensus to `/oh-my-joy:ralplan`, every command/agent that mentions a runtime also names a fallback, and goal-loop pre-approves only the bundled `goal-state.mjs` validator (never an external CLI). Each check was mutation-verified — reverting the invariant it guards fails exactly that check.

- **PR triage workflow (`pr-triage.yml`) + `CODEOWNERS`** — every PR is auto-assigned to the maintainer (assignee = the person responsible for shepherding it, so external contributions are covered too) and receives the conventional type label (`feat`/`fix`/`docs`/`test`/`chore`/`ci`/`refactor`) parsed from its title prefix, re-synced on title edits. `CODEOWNERS` auto-requests the maintainer's review. Metadata-only `pull_request_target` — the PR's code is never checked out.
- **Release automation — `scripts/release.mjs` + `release-tag.yml`** — the cut is a local script (finalizes CHANGELOG [Unreleased] into a version section, regenerates the empty skeleton, writes the 2 link lines, literal-replaces the 4 version surfaces; touches no git, never rewrites prose, 5 rejection guards, 12 behavioral tests); tagging is a workflow on the main merge push (a "plugin.json version vs tag existence" state comparison — no commit-title parsing, idempotent, tags always attach to a main commit, eliminating the v0.4.0 orphan-tag failure mode at the source; auto-publishes the GitHub Release). The keep-a-changelog 6-section skeleton invariant is also sealed by a test. contents:write is granted to release-tag.yml only.
- **New "Which command, in what order?" section in README (EN/KO)** — the full-cycle branching narrative (vague idea → deep-interview → paste spec → optional ralplan consensus → approval → execution lane/goal-loop → verification) had lived only in docs/EXECUTION-HANDOFF.md, contradicting the "narrative content is canonical in README" discipline. The mermaid flowchart now also reflects deep-interview, ralplan, and goal-loop (resolving the self-contradiction between the execution-lane nodes and the OMJ×OMC table).

- **General-purpose deep interview command `/oh-my-joy:deep-interview`** — a read-only primer that turns a vague idea into a specification through a one-question-per-round Socratic interview. It carries topology pinning (Round 0), weakest (component × dimension) targeting, a weighted ambiguity formula (greenfield/brownfield), ontology-convergence tracking, and the Restate/Closure double termination gate; the resulting spec is presented as a **native Plan body**, not a file (file creation belongs to the post-approval execution phase — preserving the read-only contract). The methodology is borrowed and rewritten from gajae-code and oh-my-claudecode (MIT); their runtimes (CLI, tmux, state conventions) were not ported (`NOTICE.md` added). Accompanied by canonical revisions of PRINCIPLES ⑧ (methodology absorption rule) and ⑪ (interview interaction class). **Full-cycle expansion stage 1 — introduced 2026-08-13, recorded mid-window of the reach re-measurement (~09-03).**
- **Two-axis command naming rule** — OMJ-specific FE loop verbs keep the existing `/omj-*` prefix; named methodology/rubric commands use an unprefixed basename + a test whitelist (`WORKFLOW_COMMANDS`) + docs always write the canonical `/oh-my-joy:<name>` invocation. Bare notation (`/deep-interview` and the like) is blocked across every tracked doc surface by the docs-consistency test — sealing, at the documentation level, invocation ambiguity with same-named OMC skills and Claude Code native commands (2-worker cross-review convergence). The read-only command check is also extended to block `Task`/`Agent` declarations on top of Write/Edit (subagents do not inherit the parent's allowed-tools).

- **Durable execution loop `/oh-my-joy:goal-loop` + `scripts/goal-state.mjs` validator** — an active op that persists an approved spec as goals under `.omj/goals/<slug>/{brief.md, goals.json, ledger.jsonl}` so a single owner runs them to completion sequentially. The crux is where the enforcement lives: the command's allowed-tools pre-approve only the validator script call, with no Write/Edit, **narrowing the state-mutation path to one** — the script checks the valid-transition table, single active goal, rejection of complete without an evidence object, append-only ledger (truncation detection), monotonic event_seq, and atomic snapshot replacement, and violations exit non-zero (reflecting the 2-worker cross-review blocker: "port only the prompt and the form survives while the enforcement dies"). Verification commands are not pre-approved — each run's permission prompt is what makes the evidence trustworthy (laundering prevention). Ships with behavioral tests (temp-dir legal/illegal transitions, truncate, reconcile) and a doc↔script vocabulary drift guard. EXECUTION-HANDOFF gains an "OMJ native lane" section (priority: with a runtime present the existing lanes stay default, without one durable is the default / the auto-select one-question boundary / full-cycle coupling), `/omj-start` gains a copyable-action path, and `/omj-setup` gains `.omj/goals/` gitignore tier guidance. **Full-cycle expansion stage 2 — introduced 2026-08-13 (recorded during the re-measurement window).**

- **Consensus review command `/oh-my-joy:ralplan` + `plan-critic` agent** — a read-only command that drives an already-existing spec/plan to consensus through adversarial review (full-cycle expansion stage 3, final). Its entry condition is pinned to "**an artifact already exists and design-disagreement risk is present**" rather than "requirements are vague" (that is deep-interview's job), separating the two stages' functions. Per the cross-review convergence, v1 is reduced to Planner normalization (Drivers, Viable Options ≥2, ADR) → one independent `plan-critic` pass → max 2 rounds → PLANNING-STUCK (best plan preserved, execution forbidden, issue list) — an Architect second pass waits for real-world measurement of high-risk triggers. The reviewer is not a built-in but an **owned agent definition** (`agents/plan-critic.md`, `tools: Read, Grep, Glob`), so its tool surface is pinned by an invariant test. Environments without subagents degrade to a sequential critic pass (⑨). **This PR itself was implemented via `/oh-my-joy:goal-loop` self-application (E2E)** — the `.omj/goals/pr3-ralplan/` ledger records start/completion/evidence for its 3 goals (a gitignored local artifact, so not part of the PR — the format is proven by `tests/goal-state.test.mjs`).

- **Agent tool-contract invariants** — tests now pin plan-critic's exact tool surface (Read·Grep·Glob), design-qa's absence of write tools, and the existence of all 3 bundled agents (preventing vacuous loop passes). The claim in the ralplan body and this CHANGELOG that "the tool surface is pinned by invariant tests" becomes true as of this point (the audit had found those tests missing).

### Changed

- **`frontend-fundamentals` skill `metadata.version` 1.1.0 → 1.2.0** — the skill's own semver, independent of the plugin version, bumped because this release changed its content: SKILL.md and all nine `references/` files were rewritten in English (342 lines changed).
- **Language policy: the repository is now English-first** — commit messages, PR/CI surfaces, marketplace metadata (`plugin.json`/`marketplace.json` descriptions), and policy docs (CLAUDE.md, CONTRIBUTING, NOTICE, PR template) are written in English from now on; README stays bilingual (EN/KO). CHANGELOG history prior to 0.6.0 is preserved in Korean.
- **Runtime script output switched to English** — every user-facing message of `scripts/release.mjs` (rejection guards, the advisory, the follow-up guide including the auto-generated `gh pr create` PR body) and `scripts/goal-state.mjs` (all validator rejections), plus `release-tag.yml` step names and Actions annotations, are now English. Behavior, CLI interfaces, the ledger event vocabulary, and ASCII output contracts are unchanged; the behavioral test suites were updated in lockstep.
- **Selector output contract switched to English literals** — the execution-lane selector (SoT: `docs/EXECUTION-HANDOFF.md`) now emits `## Execution lane selection`, `(recommended)`, and `Selected lane:` in place of the former Korean literals. **Behavior change**: newly authored specs use the English labels only; `/omj-start` additionally keeps recognizing the legacy Korean labels (`선택된 레인`, `## 실행 레인 선택`, `(추천)`) when reading specs approved before this change.
- **Plugin prompts and hook output switched to English** — all command bodies (`commands/*.md`), the 3 bundled agents, the `frontend-fundamentals` skill (SKILL.md + 9 references), and the user-facing warnings of the two token-guard hooks are now English. Frontmatter descriptions are English-first but keep Korean user-utterance trigger examples for auto-invocation matching. **Behavior change: `/omj-fix --commit` no longer mandates Korean commit messages — it follows the host project's existing commit conventions (language included).** Contract text is untouched (ledger event vocabulary, `[omj:*]` hook prefixes, the `omj-allow-color` suppression literal, legacy Korean selector labels still recognized by `/omj-start`). Hooks already copied into consuming projects keep the old Korean output until `/omj-setup` is rerun (it offers the update).
- **`docs/` switched to a single English canon** — `docs/PRINCIPLES.md` is rewritten in English as the sole canonical rationale document (absorbing the former English summary's through-line preface, eleven-row decision table, and repo-mapping section into its body), and `docs/EXECUTION-HANDOFF.md` / `docs/OMC-INTEGRATION.md` are fully translated; all three join the ENGLISH_DOCS purity check. The PRINCIPLES two-file row-sync rule in CLAUDE.md/CONTRIBUTING/PR template is retired accordingly.
- **Language purity check flipped from allowlist to denylist** — instead of enumerating English docs (`ENGLISH_DOCS`), every tracked markdown file is now checked for CJK except an explicit exemption list (`README.ko.md`, `CHANGELOG.md`), so **new documents default to English purity**. Command/agent/skill surfaces are checked frontmatter-stripped (preserving the Korean trigger-example allowance), `commands/omj-start.md` carries a minimal literal exception for the legacy selector labels it must keep recognizing, and a new guard asserts `scripts/*.mjs` and `templates/hooks/*.mjs` sources stay CJK-free (runtime output regression seal). The remaining test-suite names and comments (docs-consistency, plugin-manifest, helpers) are also in English, completing the transition.
- **BREAKING: `/omj-review` → `/oh-my-joy:ff-review` rename (2026-08-13)** — moved by user decision onto the "named methodology/rubric command" axis (unprefixed basename + canonical invocation). Replace `/omj-review [--base <ref>]` with `/oh-my-joy:ff-review [--base <ref>]` (arguments and behavior identical; only the file moved to `commands/ff-review.md`). ⚠️ A surface rename during the reach re-measurement window (~09-03) — it was the only command with confirmed real-world usage, so split counts before/after this point when interpreting the re-measurement report.
- **Deployment model codified** — the fact that the marketplace does not consume tags but downloads main HEAD, with plugin.json `version` as the deployment gate (cross-verified against official docs), was documented nowhere. The CONTRIBUTING release section is fully rewritten around the deployment model + the new automation procedure (cut → PR → auto-tagging; manual git tag forbidden), and README (EN/KO) Quick Start gains 2 lines on the update path (`/plugin update` → `/reload-plugins`).
- **Read-only command checks split into two privilege tiers** — zero-bash (omj, deep-interview, ralplan: new zero-Bash-token assertion) and report-only (ff-review, omj-verify: source-non-mutating + observation-scoped Bash). The old check never looked at Bash, leaving half of the "read-only (no Write/Edit/Bash)" claim unpinned; the conflicting vocabulary among omj-verify's "mutating active op" self-description, the CLAUDE.md definition, and the test set is reconciled as well.
- **Graceful-absence handling made uniform across all FF skill delegation layers** — the absence-handling phrase that existed only for Context7 in the routing SoT (SKILL.md "integrated routing rules") now also covers the two vercel skills and web-design-guidelines, and ff-review's per-layer duplicated narration is collapsed into a single SoT-delegation line (removing scattered rule fragments). The ff-review procedure now also names its Read/Grep/Glob call sites (preventing cohesion/coupling misjudgments from hunks alone).
- **FF skill triggers scoped with FE qualifiers** — removed the misfire surface where bare "refactoring"/"code review" in the description could auto-activate on backend code reviews. The rule that `metadata.version` is an independent semver bumped only on content-changing releases is codified in CONTRIBUTING, and it is bumped to 1.1.0 (fixing the neglected 1.0.0).
- **Four verification-harness blind spots hardened** — ① the MCP dual-prefix check gains the reverse direction (bare→plugin variant; forward-only let bare-only declarations pass), ② the bare-slash notation check moves from exact matching to a boundary regex (catching argument-bearing inline code and fenced code blocks), ③ the "document only real commands" check expands from README-only to all tracked markdown (+ explicit allowlists for announced v1.1 commands and pre-rename history), ④ the canonical install string is assembled from the manifest instead of a literal. CI also aligns from direct `node --test` to `npm test` (staying coupled to scripts.test).

### Deprecated

### Removed

- **`docs/PRINCIPLES.en.md`** — the English summary table is no longer a separate file; its content was promoted into the now-English `docs/PRINCIPLES.md`, which removes the drift window between the two files.

### Fixed

- **README (EN) mislabeled three English docs as Korean** — leftover from the English-first transition: `docs/EXECUTION-HANDOFF.md`, `docs/OMC-INTEGRATION.md`, and `docs/PRINCIPLES.md` were annotated "(Korean)" on the English page while all three contain zero Hangul, and README.ko.md already described PRINCIPLES as English — the two pages contradicted each other. The stale annotations are removed.

- **deep-interview execution bridge gains the goal-loop durable path** — goal-loop.md and EXECUTION-HANDOFF name interview output as a first-class goal-loop input, yet the bridge never offered that path — an SoT contradiction that left runtime-less users without guidance to the durable lane.
- **README privilege-classification sentence updated for the new commands** — the read-only list was missing ralplan and the active-op list was missing goal-loop (the only privilege/mode classification sentence, yet 2 of the 4 new commands were absent). The command table gains deep-interview's suitability gate and `--threshold`, goal-loop's `--slug` resume call form and paste as first-class input, ralplan's early exit, and ff-review's no-argument default; troubleshooting gains 3 entries — "interview ends immediately = the gate", "goal-loop permission prompt = intended", and `.omj/goals/` gitignore. README (EN/KO) documentation of argument-hint flags is now pinned by an invariant test.
- **Removed omj-start's unused `Grep` declaration** — a violation of the rule (CLAUDE.md) against declaring tools with no call site in the body. Read + AskUserQuestion complete the procedure.
- **Hooks could not be installed in consuming projects** — `/omj-setup`'s hook-copy step did not anchor the source path to the plugin root, so it looked for `templates/hooks/`, absent from the consuming project's cwd, and failed (masked in the dogfood repo where cwd == plugin root). Fixed by writing `${CLAUDE_PLUGIN_ROOT}/templates/hooks/` alongside + a path invariant test. `cp`, `mkdir`, and `claude plugin install` Bash scopes also narrowed to actual call sites.
- **Hook registration matcher aligned with the script's 4 `MUTATING_TOOLS`** — the install procedure's `Edit|Write` matcher was narrower than the script filter (Edit, Write, MultiEdit, NotebookEdit), so MultiEdit saves silently bypassed the hook.
- **Hook fail-open hole sealed** — both hooks read fe-context outside try/catch, so an unreadable context (directory, permissions) leaked an uncaught exception as exit 1, breaking the "inspect only, exit 0" contract. Wrapped in try/catch as no-op + 2 contract tests.
- **`$schema` pointed at 404 URLs** — the anthropic.com schema URLs in plugin.json/marketplace.json measured 404, making the "editor validation" the tests claimed vacuous. Replaced with the SchemaStore-listed versions (measured 200) and strengthened the test from an existence check to canonical URL literal pinning.
- **Full-cycle doc drift corrected in one sweep** — drift left by PR-2/PR-3 (goal-loop, ralplan) landing code without the principle docs: ① PRINCIPLES ⑦ (KO/EN)'s "durable is not replicated" absolute is conditioned into "with a runtime present, handoff is the default; absent one, the OMJ native lane from ⑧'s absorption rule is the default — and it remains an always-available explicit choice for evidence-enforced completion", resolving the SoT conflict with EXECUTION-HANDOFF; ② PRINCIPLES.en.md gains goal-loop/ralplan/plan-critic (including fixing a self-contradictory rejected-alternative row); ③ the README (EN/KO) agent section adds plan-critic, drops the stale "(v0.3.0)" label, "2 agents"→3; ④ OMC-INTEGRATION reflects the 3 OMJ-native full-cycle commands; ⑤ CONTRIBUTING release steps corrected to the 4 version surfaces (following the old 2-surface steps failed the tests); ⑥ the PR template gains the PRINCIPLES.en.md companion-update item.
- **NOTICE relative links (deep-interview, goal-loop, ralplan) gain runtime paths** — in installed plugin prompts, relative links resolve against the consuming project's cwd, so `${CLAUDE_PLUGIN_ROOT}/NOTICE.md` is now written alongside (relative links kept for GitHub rendering).
- **design-qa description gains a non-trigger clause** — the only one of the 3 bundled agents without a "these requests are not this agent" statement, leaving auto-delegation misfire room. Its boundary with qualitative review (ff-review) and the fix loop (omj-fix) is now explicit.
- **goal-state init made atomic** — init wrote step-by-step into the final path, so mid-crash residue could occupy the path and make re-init, other verbs, and reconcile all refuse — an unrecoverable state. Replaced with a build-in-temp-then-rename atomic move (extending writeSnapshot's contract to all of init; serialization/stamping reuse the single appendEvent/writeSnapshot path). Includes cleanup of `.tmp-` residue left by other pids and self-cleanup on failure. CLI and file contracts unchanged.
- **goal-loop's Task non-declaration codified as intended** — the body directing subagent convocation while allowed-tools lacked Task read like a defect. The rationale — the permission prompt at convocation time is the confirmation point (PRINCIPLES ③) — is now a blockquote in the body (mirrored into ralplan's critic-convocation step for symmetry). CLAUDE.md also codifies that an agent's unspecified `model` field = session-model inheritance by intent.

### Security

- **`Bash(command:*)` pre-approval removed** — `command` is a shell builtin that executes its arguments verbatim, so this scope was effectively bare Bash (a laundering path that used scope syntax while approving arbitrary execution). The 3 commands (omj-verify, omj-fix, omj-setup) are narrowed to the actual call `Bash(command -v:*)`, and declarations whose entire prefix consists of execution-delegating builtins/interpreters/delegation flags (including `Bash(sh -c:*)`, `Bash(npx:*)`) are blocked by a heuristic invariant test (a review-visibility gate, not a sandbox — limits stated in the test comments). The Bash call-site check is also strengthened from substring to a word-boundary regex — sealing the hole where coincidental matches in Korean prose passed vacuously.
- **goal-state `--brief-file` absolute-path guard's win32 hole sealed** — the guard was POSIX-only (leading `/`), letting Windows drive (`C:\…`, `C:/…`) and UNC (`\\srv\…`) absolute paths and backslash traversal through — arbitrary file reads under the pre-approved Bash rule. Now also uses `path.win32.isAbsolute` + 4 rejection-case tests.

## [0.5.0] - 2026-08-06

> **도달률 릴리스.** 31일 dogfood 마이닝(세션 로그 118개·소비 레포 git 66커밋·OMX 336커밋·.omc 아티팩트 21편)이 "품질이 아니라 도달률 문제"를 실증했다 — 호출된 커맨드는 마찰 없이 동작했지만 침투율 6.8%, 커맨드 7개 중 5개 사용 0회, 플래그십 루프(스크린샷 62장/24세션)가 전부 플러그인 밖에서 수동으로 돌았다. 이 릴리스는 기능 추가가 아니라 **도달 경로**를 고친다: 트리거 재작성·온보딩 자동 제안·라우팅 drift 정정·조용한 오검증 차단. 전 변경이 근거 로그와 ralplan 합의(Planner→Architect→Critic, 게이트 선행)를 거쳤고, 배포 전 불변식 테스트 2종과 격리 클론 스모크를 통과했다.

### Added

- **figma 공식 스킬과의 역할 경계 명문화** — `/omj` Phase 1에 경계 1절: 상류 `figma-design-to-code` 스킬이 `get_design_context` 호출 전 로드를 MANDATORY로 규정하지만, 프라이밍은 이를 **알고도 따르지 않는 의도적 결정**이다(그 스킬은 구현 전제 — read-only plan-gate 정체성 침식). 상류 지침은 승인 후 구현 단계가 따른다. 트리거 재작성으로 라우팅 경쟁에 들어간 뒤 동시 로드(마이닝 관측 6회) 시 역할 경계가 미정의였던 갭을 해소 — 단, 이 절은 발동 경쟁 자체를 중재하지 않는다(그 층은 description 담당). PRINCIPLES ③(+en)에 "버그가 아니라 결정" 명문화.
- **도구 선언 불변식 테스트 2종** — 같은 결함 클래스 3회 재발 후 ralplan 합의로 도입. (a) 플러그인 경유 MCP 선언(`mcp__plugin_<plugin>_<server>__*`)에 bare 서버 변형 병기 강제, (b) `Bash(…)` 선언의 명령 문자열이 frontmatter 제외 본문에 존재하는지 검증(언급 기반 게이트임을 주석 명시). 도입 시점에 실제로 잔존 결함 3건을 검출했다 — `omj-review`·`omj-fix`의 bare `mcp__context7__*` 누락(직전 이중 프리픽스 수정이 3/5 지점만 커버), `omj-setup`의 `Bash(mkdir:*)` 호출 지점 부재(→ 훅 설치 절차에 `mkdir -p .claude/hooks` 성문화). 셋 다 수정 후 149 테스트 통과.
- **`/omj-verify` 도달 라우트 검증 필수화** — 캡처를 증거로 쓰기 전에 현재 페이지가 요청한 `$ROUTE`에 실제 도달했는지 확인하고, 인증 리다이렉트 화면이면 비교하지 않고 "예상 라우트 미도달"을 실패로 보고한다. dogfood 마이닝 Phase C에서 인증 게이트 라우트 캡처가 3개 레포에서 실패했고(스킵/오검증/우회 제각각) 리다이렉트된 화면을 찍고 통과시킬 뻔한 실사례가 있었다 — 잘못된 결과를 자신 있게 보고하는 유일한 실패 모드를 차단한다. fe-context `verifySetup` 주석에 쿠키 주입·가드 목킹 옵션을 명시.

### Changed

- **`/omj-setup` 온보딩 개편 — 도달률 개선** — dogfood 마이닝에서 setup 실행 0회가 fe-context·훅 미설치의 연쇄 원인으로 확인됐다(Phase D). 네 가지를 바꾼다: ① `/omj`가 셋업 흔적 없음을 감지하면 스펙 말미에 1회 제안(자동 실행 아님), ② 누락 항목별 개별 질문을 **한 번의 multiSelect 일괄 선택**으로 교체(PRINCIPLES ⑪), ③ fe-context 스캐폴딩 전에 기존 규칙 문서(`AGENTS.md`·`.claude/rules/`·copilot-instructions)를 탐지해 **`contextDocs:` 참조-채택을 우선**(내용 복제 금지 — 실측에서 fe-context가 겨냥한 정보는 이미 이런 파일들로 존재했고, 리뷰 정확도를 올린 건 과거 결정 목록이라 `decisions:` 필드도 신설), ④ 마무리에 **GitHub star opt-in**(이미 starred면 무프롬프트 스킵, silent fail, gh 부재 시 URL 안내 — OMC omc-setup 패턴, 사용자 지시). `gh` Bash 권한은 star 호출 지점에 맞춘 최소 prefix(`gh auth status`·`gh api user/starred/S-jooyoung/oh-my-joy`)로만 선언.
- **`check-story-exists` 훅 제안 조건화** — Storybook 신호(`.storybook/`·`@storybook/*` 의존성·`*.stories.*`)가 감지될 때만 설치 선택지에 넣는다. 훅 자체는 fe-context 미선언 시 no-op이라 안전했지만, 대상 관행이 없는 프로젝트에 제안하는 것 자체가 노이즈였다(31일 실측에서 Storybook 실질 언급 0회). 범용 플러그인이므로 기능 제거가 아니라 제안 조건화로 처리.
- **`/omj`·`/omj-fix` 트리거 재작성 — 도달률 개선** — dogfood 마이닝 결과 31일간 OMJ 침투율 6.8%, Figma Dev Mode 붙여넣기 22건 중 OMJ 도달 7건(전부 수동 타이핑), 스크린샷+시각 결함 서술 37턴에 `/omj-fix` 사용 0회. 원인은 기능이 아니라 진입 경로 — 공식 figma 스킬은 붙여넣기 문구에 auto-trigger로 붙는데 OMJ description은 그 패턴을 담지 않았다. 두 커맨드의 description을 실관측 트리거(figma.com 링크·"이 디자인 구현해줘"·스크린샷+정렬/잘림/간격/색 불만)에 맞춰 재작성하고 README(EN/KO)에 자동 발동 안내를 추가.

### Deprecated

### Removed

### Fixed

- **figma/context7 MCP 사전승인이 플러그인 설치 경로 이름에만 의존하던 문제** — 소비자가 Figma MCP를 raw로 등록하면(`claude mcp add figma`) 도구명이 `mcp__figma__*`가 되어 커맨드 사전승인이 풀리고 `figma-implementer`는 도구를 아예 잃었다. v0.4.0이 playwright 폴백에 적용한 이중 선언("설치 출처에 따라 이름이 달라진다")을 figma·context7에도 적용 — `commands/omj.md`·`commands/omj-sync.md`·`agents/figma-implementer.md`에 bare 변형 병기. 플러그인 구성 점검(plugin-validator)에서 발견.
- `marketplace.json`의 "개인 프론트엔드 플러그인" 문구를 범용 서술로 정정 — 도메인 중립 원칙과 어긋나는 잔재였다.
- **OMX `$ralplan` 드리프트 정정** — OMX가 합의 레인에 호스트 영수증 게이트를 도입해(ADR 3212 계열) `$ralplan`이 **계획 산출 후 정지**(fail-closed)하게 됐는데, OMJ 문서 전반이 `/ralplan`/`$ralplan`을 한 쌍의 "합의 후 실행 연결 레인"으로 서술하고 있었다 — selector가 이를 추천하면 사용자는 blocker만 받는다. 라우팅 SoT(`docs/EXECUTION-HANDOFF.md`)에 런타임 비대칭을 명시하고, OMC-INTEGRATION·PRINCIPLES·README(EN/KO)·CLAUDE.md·`commands/omj.md`·`commands/omj-start.md`는 요약/링크로 정리. 근거: dogfood 마이닝 Phase A(`.omc/research/omj-dogfood-mining-2026-08.md`).
- README(EN/KO) 계획 행의 `/omc-plan` 표기 정정 — OMC에 그 커맨드는 존재하지 않는다(계획 진입점은 skill `/oh-my-claudecode:plan`).
- Syntax map의 `$team`/`omx team`에 런타임 표면 단서 추가 — Codex App·tmux 밖 세션에서는 직접 제시하지 않는다(shell에서 OMX CLI 선기동).
- `/omj-start`의 OMX direct launch를 2단계 CLI로 정정 — `create-goals`는 goal **생성만** 하므로(시작은 `complete-goals`), 생성 후 최종 copyable action을 `omx ultragoal complete-goals`로 출력한다. 기존 계약은 goal만 만들고 아무것도 실행되지 않은 상태로 사용자를 남겼다.

### Security

- `/omj-start`의 `Bash(git status:*)` 선언 제거 — 본문 절차에 호출 지점이 없었다("호출 지점 없는 도구는 선언하지 않는다" 규칙 정합). `/omj-fix`의 `git status`/`git diff`는 반대로 본문 step 6에 호출 지점을 성문화.
- `/omj-setup`의 gh star 권한을 `:*` prefix에서 **정확 매칭 2개**로 분리(`gh api user/starred/S-jooyoung/oh-my-joy` + 동일 경로 `-X PUT`) — 기존 와일드카드는 호출 지점이 없는 `-X DELETE`(unstar)까지 사전승인했다.

## [0.4.0] - 2026-07-27

> 레포를 6개 축(훅 코드 정확성 · 문서 SoT 정합 · 플러그인 스펙 준수 · 최소권한/주입 표면 · 외부 관점 · 번들 지식 정확성)으로 감사하고, 각 발견을 파일 근거로 적대적 검증한 뒤 확인된 것만 반영한 릴리스. **핵심은 "선언한 것을 실제로 강제하는 층을 만든 것"** — 문서가 주장하던 안전 속성(최소권한·read-only·zero-hook·EN/KO 패리티) 중 상당수가 산문일 뿐이었고, 이제는 매니페스트와 테스트가 강제한다. 강제할 수 없는 부분은 과장을 걷어내 실제 동작대로 다시 적었다.

### Added

- **검증 하네스** — `node --test` 기반 무의존성 테스트 스위트(`tests/`). 훅 스크립트를 실제 자식 프로세스로 띄워 PostToolUse 계약(stdin JSON → stdout JSON → exit code)을 경계에서 검증한다. `package.json`은 `private: true`인 dev 전용이며 플러그인 런타임 의존성은 여전히 0개다.
- `docs/PRINCIPLES.en.md` — 11개 설계 원리를 `문제 / 결정 / 버린 대안` 3열 표로 요약한 영문 페이지. 설계 문서 3종이 전부 한국어라 이 레포의 유일한 심층 콘텐츠가 영어 사용자에게 통째로 불투명했다. **정본은 여전히 `PRINCIPLES.md`**이며, 드리프트를 막기 위해 CLAUDE.md 문서화 규율에 "원리 변경 시 요약표의 해당 행도 같은 커밋에서 갱신"을 편입했다.
- `CONTRIBUTING.md`·`.github/PULL_REQUEST_TEMPLATE.md` — 레포의 실제 규율(zero-hook 불변식·최소권한·EN/KO README 동시 갱신·AI 서명 금지)을 외부에서 재현 가능한 형태로 성문화.
- `references/boundaries.md` 신설 — React 19/App Router 코드 품질의 최대 축인 **Server/Client 경계·에러 경계·테스트 가능성**이 번들된 지식에 전혀 없었고, 유일한 처리 방식이 "선택적으로 스킵 가능한" Context7 위임이라 실질적으로 무루브릭이었다. 직렬화·Suspense 스트리밍처럼 `vercel-react-best-practices`가 소유한 지식은 복제하지 않고 링크만 둔다(⑧ SoT 단일화) — 이 문서는 "어디에 선을 긋는가"만 다룬다.
- `references/a11y.md`에 WCAG 2.2 핵심 축 4개 추가 — **색 대비**(SC 1.4.3/1.4.11), **포커스 가시성**(2.4.7/2.4.11, `outline:none` 시 `:focus-visible` 필수), **모션 축소**(2.3.3, `prefers-reduced-motion`), **폼 에러 안내**(3.3.1/3.3.3, `aria-invalid`+`aria-describedby`+`role="alert"`). 실무 a11y 리뷰의 최빈 결함군이 통째로 루브릭에서 빠져 있었다.
- **CI**(`.github/workflows/ci.yml`) — push·PR마다 Node 20·22·24에서 검증 스위트를 실행한다. 훅 스크립트는 플러그인 레포가 아니라 소비 프로젝트의 Node에서 돌아가므로, `engines` 하한(20)을 버리지 않고 현재 유지되는 LTS 라인(22 maintenance·24 active)을 함께 검증한다. 의존성 설치 단계가 없다.
- **매니페스트·문서 정합성 자동 검증** — CLAUDE.md의 "문서화 규율"을 사람의 성실성이 아니라 기계가 강제한다: plugin/marketplace 스키마와 버전 일치, 커맨드·에이전트·스킬 frontmatter 유효성, **`hooks.json` 부재(zero-hook 불변식)**, README EN/KO 패리티와 설치 문자열 동일성, 영문 README의 한국어 잔재, CHANGELOG 릴리스 링크 정의, 전 마크다운의 상대 링크 무결성, README↔`commands/` 목록 일치, CLAUDE.md 120줄 상한.
- 훅 인라인 억제 주석 `omj-allow-color` — 외부 SDK 고정색처럼 정당한 raw 값이 있는 줄의 경고를 끈다(eslint-disable-line과 같은 역할). 구문만으로는 색상과 식별자를 구분할 수 없는 잔여 오탐의 탈출구.
- 훅이 `tool_name`을 확인해 변경 도구(`Edit`/`Write`/`MultiEdit`/`NotebookEdit`)에서만 발화한다 — 소비 프로젝트의 matcher가 넓어져도 읽기 도구에서 침묵하는 방어층.
- `.omj/fe-context.md`에 `storiesDir:` 선언 추가(선택) — Story를 형제 파일이 아니라 별도 디렉터리에 모으는 프로젝트를 `check-story-exists.mjs`가 지원한다. 축은 여전히 프로젝트가 선언한다(PRINCIPLES ⑩). 포맷 정본은 `references/fe-acceptance.md`.

### Fixed

- `check-design-tokens.mjs` — **탐지 신호/노이즈 역전 해소**. 실측에서 이 훅은 오탐 4건을 보고하면서 같은 파일의 진짜 하드코딩 2건을 놓쳤다. (a) `url(#gradient)`·`href="#section"`·private field `this.#abc`·5·7자리 hex를 색상으로 오인하던 것을 제거하고, (b) 블록·JSX(`{/* */}`)·인라인 `//` 주석을 라인 수 보존 방식으로 마스킹하며, (c) Tailwind v4/shadcn 생태계의 주 문법인 `hsl()`·`oklch()`·`hwb()`·`lab()`·`lch()`와 CSS 선언 위치의 네임드 컬러를 새로 탐지한다. `hsl(var(--h) …)`처럼 `var()`로 감싼 호출은 토큰 사용이므로 위반이 아니다.
- `check-design-tokens.mjs` — 검사 대상에 `.ts`/`.scss`/`.sass`/`.less` 추가(CSS-in-JS 테마 객체와 SCSS가 빠져 있었다). 경고 개수를 라인 수가 아닌 **실제 색상 개수**로 집계. 경로 해석 기준점을 훅 계약이 준 `cwd`로 통일(`path.resolve(filePath)`는 훅 프로세스 cwd를 써서 상대경로 입력 시 검사가 조용히 스킵됐다). 프로젝트 루트 밖 파일은 읽지 않는다.
- **`allowed-tools`의 강제 수준을 과장하던 서술 정정** — `docs/PRINCIPLES.md` ③이 "쓰기 경로 자체가 없으니 plan-gate를 우회할 방법도 원천적으로 사라진다"고 단언했지만, `allowed-tools`는 하드 차단이 아니라 **사전승인 목록**이다(목록에 없는 도구는 권한 프롬프트로 드러난다 — 같은 레포의 `/omj-start` 항목이 바로 그 성질에 기대고 있다). 하드 차단은 Plan 모드가 담당한다. 정본·README(EN/KO)·영문 요약표를 "조용한 쓰기가 불가능하다"는 정확한 서술로 통일.
- `docs/EXECUTION-HANDOFF.md`가 "레인 선택 규칙을 중복 정의하지 않는다"고 선언하면서 `commands/omj.md`는 SoT 도달 불가 시의 fallback 매핑을 갖고 있어 문서가 스스로를 위반했다 — **임계값은 SoT에만, fallback은 방향만**이라는 경계를 명시해 해소(graceful degradation과 SoT 단일화의 교차점).
- **playwright MCP 폴백이 권한 선언에 없어 실제로 호출 불가였다** — v0.3.0이 대표 기능으로 광고한 폴백인데 `/omj-verify`·`/omj-fix`의 `allowed-tools`에 어떤 playwright MCP 도구도 없었다. 두 커맨드에 `mcp__playwright__*`와 플러그인 프리픽스 변형을 함께 선언한다(설치 출처에 따라 이름이 달라진다).
- `/omj-sync check`를 "read-only라 어느 모드에서든 안전"하다고 단언하던 문구 정정 — `allowed-tools`는 커맨드 단위라 check 실행 세션도 `Edit`/`Write`/`use_figma` 권한을 그대로 들고 있다. read-only 보장의 강제층이 권한이 아니라 본문 규율임을 명시한다.
- `/omj-sync`의 토큰 탐지 SoT 인용이 4단계 중 2단계만 옮겨 적어 CSS/Tailwind 기반 스토어가 누락됐다 — 나열을 지우고 SoT로 위임하되, sync/push/extract가 **파일 기반 스토어만** 대상으로 한다는 경계를 명시(`fe-acceptance.md`와 정합).
- **설치 문자열이 작성자 로컬 경로를 가리키던 문제** — README(EN/KO)의 Quick Start 1행이 `~/projects/oh-my-joy`라 공개 레포를 클론한 누구도 설치할 수 없었다(작성자 머신에서조차 실제 경로와 불일치). `/plugin marketplace add S-jooyoung/oh-my-joy`로 정정.
- CHANGELOG 릴리스 링크 — `[0.3.0]` 링크 정의가 없어 GitHub에서 리터럴로 렌더됐고, `[Unreleased]`가 한 단계 옛 버전(v0.2.0)을 기준으로 비교해 0.3.0 변경분이 Unreleased로 잡혔다. 두 항목 모두 정정.
- 커맨드 본문의 SoT 포인터가 `[텍스트](${CLAUDE_PLUGIN_ROOT}/docs/…)` 형태의 마크다운 링크라 GitHub에서 404가 됐다 — 런타임 경로 문자열은 유지하고 링크 마크업만 벗겨 레포 기준 경로를 병기한다.
- 영문 README에 한국어 `(추천)`이 설명 없이 노출됐다. 라벨 리터럴은 출력 계약(`docs/EXECUTION-HANDOFF.md`)이 고정한 값이라 유지하고, 영어 설명을 병기한다.
- `plugin.json`에 `$schema` 선언 추가 — `marketplace.json`만 스키마가 걸려 있어 에디터 검증이 한쪽에만 적용됐다.
- **FF 스킬의 도메인 중립성 위반 제거** — 범용 FE 품질 가이드를 표방하면서 특정 개인 프로젝트 스택의 잔재가 남아 있었다(같은 레포가 선언한 도메인 중립 원칙과 정면 충돌). `yarn build`→프로젝트 빌드 스크립트, shadcn 고유 컴포넌트·props(`DialogContent`/`showCloseButton`/`FormField`)→접근성 프리미티브 라이브러리 일반 서술, Supabase RLS(`auth.uid()`)→"인가 계층이 권한 부족을 0행으로 돌려주는" 일반 증상으로 치환.
- `references/a11y.md` alt 예제가 컴파일되지 않는 코드였다 — `next/image`는 `alt`를 필수 prop으로 강제하므로 "alt 누락" Before는 타입 에러다. 컴파일되면서 실제로 잘못된 케이스(무의미한 `alt="image"`, 정보성 이미지를 `alt=""`로 오분류)로 교체하고, 판정 기준을 alt **존재**에서 alt **적절성**으로 옮겼다.
- `references/bundling-debug.md`의 코드 스플리팅 예제에 `import dynamic from 'next/dynamic'` 누락 — 그대로 붙여넣으면 동작하지 않는 스니펫이었다. `ssr: false`가 Server Component에서 불가하다는 주석도 병기.
- 위임 대상 스킬을 "58규칙"으로 인용하던 것을 수치 없는 표현으로 교체(SKILL.md·bundling-debug.md) — 상류 규칙 수는 바뀌므로 인용 자체가 드리프트 원천이다. 대신 `package.json`의 `react`/`next` 버전으로 **어느 절을 적용할지만** 정하는 버전 게이팅 규칙을 추가(규칙 내용은 복제하지 않음).
- `check-story-exists.mjs` — **Story 대상이 아닌 파일에서 상시 발화하던 문제 해소**. (a) 제외 판정을 전체 경로가 아닌 **파일명 기준**으로 바꾸고 Next.js App Router 예약 파일(`page`·`layout`·`template`·`loading`·`error`·`not-found`·`route`·`default`·`middleware` 등)을 제외한다. (b) `Button/index.tsx` 배럴 패턴에서 형제 `Button.stories.tsx`를 인정하도록 디렉터리명을 후보에 추가(가장 흔한 배치인데 100% 오탐이었다). (c) 소문자로 시작하는 파일은 훅·유틸 관례로 보고 검사하지 않는다. (d) 도달 불가능하던 `\.d\.ts$` 죽은 분기 제거(선행 `.tsx|.jsx` 게이트가 먼저 탈락시킨다). (e) 경로 기준점을 `cwd`로 통일하고, 읽을 수 없는 디렉터리는 "Story 없음"으로 단정하지 않는다.

### Security

- **`/omj-start`의 safe-path 가드가 산문일 뿐이었다** — 본문이 4개 조건을 규정하는 동안 `allowed-tools`의 `Bash(omx ultragoal create-goals:*)` 와일드카드가 그 prefix 뒤 **모든 인자**를 사전승인해, 가드가 한 겹도 강제되지 않았다. 해당 권한 선언을 제거해 직접 launch 시 권한 프롬프트가 실제 확인 게이트가 되게 한다(PRINCIPLES ③의 일관 적용 — 직접 launch 자체는 `docs/EXECUTION-HANDOFF.md`가 정의한 의도된 설계라 유지).
- `/omj-start` safe-path 규칙에 **경로 봉쇄** 추가 — 기존 패턴은 shell metacharacter만 막고 *어떤 파일을 가리키는지*는 통제하지 않아 절대경로·`..` traversal이 그대로 통과했다. 새 셸 권한 없이 문자열만으로 검사 가능한 조건(절대경로 금지·`..` 금지·`.md` 확장자)을 추가.
- `/omj-setup` 최소권한 정합화 — 본문에 호출 지점이 없는 `Bash(node:*)`·`Bash(jq:*)`·`Bash(ls:*)` 제거. 특히 `Bash(node:*)`는 `node -e "<임의 코드>"`를 사전승인하는 사실상의 임의 코드 실행 권한이었다(훅 등록은 문자열 `Write`이지 실행이 아니라 제거해도 영향 없음). `Bash(npm:*)`→`Bash(npm i -g playwright-cli:*)`, `Bash(claude:*)`→`Bash(claude plugin list:*)`+`Bash(claude plugin install:*)`로 축소.
- `/omj-fix` 커밋 스테이징 범위 하드 규칙 — step 4에서 `Edit`한 경로만 명시 스테이징하고 `git add -A`·`git add .`를 금지한다. `--commit` 없이 호출되면 git 계열을 아예 실행하지 않는다.
- `/omj-verify` 인자 검증 규칙 추가 — `ROUTE`·`BASE`는 사용자 입력이 셸에 들어가는 유일한 지점인데 아무 검증 없이 치환하도록 지시하고 있었다(`/omj-start`만 safe-input 계약을 갖고 있어 커맨드 간 태세가 불일치했다). 치환 전 형식 확인 + 항상 큰따옴표 변수 참조로 사용.
- **자격증명·인증 화면 유출 가드** — `JOY_TEST_EMAIL`/`JOY_TEST_PASSWORD`로 실제 로그인을 수행하면서 경고가 레포 전체에 한 줄도 없었다. `fill`에는 변수 참조만 넘기고 값을 리포트에 적지 않기, 테스트 전용 계정 사용, 인증 후 스크린샷의 baseline 영속화 고지, `.omj/baselines/` gitignore 필수화를 명문화(README EN/KO 동기화).
- `agents/design-qa.md`에 **강제 수준 고지** 추가 — `Edit`/`Write` 미부여는 도구 층 강제지만 스코프 없는 `Bash`가 있어 "`--fix` 금지"는 프롬프트 수준 규율일 뿐임을 명시하고, 기계적 강제가 필요할 때의 대안(`/omj-review` 또는 `permissions.deny`)을 안내한다.

## [0.3.0] - 2026-07-14

> 실사용 dogfood(ahmotravelReact `/omj` 풀 사이클) 피드백 + 디자인 시스템 하네스 스펙 흡수 + 플러그인 구조·사용 감사 결과를 ralplan 합의(Planner→Architect→Critic 3라운드)로 확정해 반영한 릴리스.

### Added

- `/omj-start` — 승인된 OMJ 스펙을 OMC/OMX 실행 레인으로 넘기는 canonical fallback handoff command. `/omj`가 이미 선택한 lane이 있으면(수동이든 `(auto)`든) 다시 묻지 않고, 직접 시작이 불확실하면 copyable action 한 줄만 출력한다.
- `docs/EXECUTION-HANDOFF.md` — `/omj` 실행 레인 selector의 단일 SoT. Wrapper(`/goal`/`$ultragoal`)와 Sublane(`/team`/`$team`, `/ralph`/`$ralph`) 분리, option 1 `(추천)` 출력 계약, `/goal clear` 안전 규칙 + **auto-select 규칙**(추천이 `Wrapper=none; Sublane=inline/manual`일 때만 질문 생략·`(auto)` 기록, Plan 승인=레인 동의 — 무거운 레인은 항상 1회 질문. 실사용에서 관측된 "레인 질문+Plan 승인 이중 인터럽트" 해소, PRINCIPLES ⑪ 정합).
- `skills/frontend-fundamentals/references/figma-fidelity.md` — design→code 보편 규칙 신설(원본 텍스트 유지·Figma에 없는 variant 임의 생성 금지·고정 px 너비 금지(w-full+부모 padding)·토큰 하드코딩 금지). `/omj` Phase 2가 처방, `/omj-review`·`design-qa`가 검증(같은 SoT).
- `agents/figma-implementer.md` — 승인된 OMJ 스펙 전담 구현 에이전트(Clarify→Context→Plan→Generate→Evaluate 5단계, Figma 읽기 4도구, 실패 2회 재시도 후 보고). **호출 계약**: 스펙 없는 bare Figma URL은 구현 거부 + `/omj` 안내(plan-gate 우회 차단). 레인이 아니라 inline 레인이 쓰는 실행자 — EXECUTION-HANDOFF(라우팅 SoT)·selector에는 미등장, OMC/OMX 레인 우선.
- `agents/design-qa.md` — 기계 점검 게이트(타입체크·린트(--fix 금지)·토큰 하드코딩 grep·Figma 충실도·a11y 기본 + fe-context 선언 시에만 Story·i18n 체크). 계약: "소스·설정 비수정 능동 op"(검사만, 수정 없음).
- `templates/hooks/check-design-tokens.mjs`·`check-story-exists.mjs` — 토큰 하드코딩/Story 누락 경고 훅 스크립트(Node, 크로스플랫폼). **플러그인은 hooks.json을 두지 않아 스스로 발화하지 않는다**(zero-hook 유지) — `/omj-setup`이 소비 프로젝트 `.claude/hooks/`로 **복사-설치**할 때만 동작(참조-등록은 소비 settings.json의 `${CLAUDE_PLUGIN_ROOT}` 미해석·플러그인 캐시 버전 경로 파손 때문에 불가). fe-context 선언 없으면 no-op 이중 안전.
- `/omj-sync extract <figma-url>` — Figma 변수 → CSS custom properties 부트스트랩 모드(`/`→`-` 변환, primitive→semantic `var()` 참조 유지, 컬렉션별 파일 분리, `docs/design-tokens.md` 매핑 테이블). 기존 파일 덮어쓰기는 AskUserQuestion 가드.
- `.omj/baselines/` 규약 — `/omj-verify`·`/omj-fix`가 Figma 에셋을 `<route-slug>@<viewport>.png`로 영속화(`curl -f --remove-on-error`, 0-byte 잔존 방지)해 크로스세션 시각 비교를 가능하게 함. slug 변환 규칙 명문화. provenance(노드ID·에셋URL·captured-at)는 스펙 문서가 SoT(sidecar JSON은 verify 권한상 저장 불가로 기각).

### Changed

- `/omj` — 실행 레인 질문을 "정확히 1회" → "**최대 1회**"(auto-select 시 생략)로 조건화. Phase 0 디스패치를 figma/dev 이분법 → **신호 존재 기반 합성**(figma URL+텍스트 작업 혼합 시 양 트랙 병행, 노드 5개 초과 분할 제안, 첨부 이미지 해석 기록, Figma 'Copy as prompt' 보일러플레이트 무시)으로 확장. route 인자 부재 시 코드 탐색으로 **추론 기록**(`검증 route(추론):` 라벨). Color/Tokens의 토큰 탐지를 fe-acceptance.md SoT로 위임("tokens.json 부재 ≠ raw hex 면죄부"). figma 프라이머 시 baseline provenance 기록.
- `/omj-verify` — **allowed-tools에 `Read` 추가**(스펙 URL 판독·baseline PNG 비전 로드에 필수 — 없으면 baseline 비교 자체가 불가). 비교 기준 3단계화(①세션 컨텍스트 → ②`.omj/baselines/` 온디스크 PNG → ③구조 점검만). **playwright MCP 폴백** 신설(playwright-cli 부재 시 — 사용 감사에서 30일간 verify 호출 0회의 구조적 원인이 도구 불일치로 확인됨). fe-context `verifySetup` 선언 소비(인증 우회·API 목 절차의 프로젝트 선언화).
- `/omj-sync` — 토큰 스토어를 DTCG json 전용 → **CSS custom properties(`*.css`) 동시 지원**으로 확장(파싱: `var(--x)`=alias). **allowed-tools에 `Write` 추가**(extract 전용 — check/sync/push는 Write 금지 본문 강제). check 출력에 "추가할 토큰 코드 제안" 블록. **Figma 변수 접근은 편집 권한 필요**(뷰어 파일은 Duplicate) 실측 명문화.
- `/omj-setup` — `.omj/fe-context.md` 스캐폴딩(감지 후보는 **주석으로만**, acceptance 축 자동 선언 금지 — 원칙 ⑩ 보존), `docs/DESIGN.md` 빈 틀 초안(선택), 토큰 가드 훅 복사-설치(opt-in), 캡처 백엔드 점검을 playwright-cli 또는 MCP로 확장.
- `.omj/fe-context.md` 스키마 확장(fe-acceptance.md SoT) — `conventions:`·`designDocPath:`·`storybook:`·`verifySetup:` 추가(전부 선택). **토큰 시스템 탐지 순서**(fe-context → tokens.json → Tailwind @utility → CSS 변수)를 fe-acceptance.md에 1회 정의하고 omj.md·omj-setup·omj-sync가 참조(탐지 로직 이중 정의 제거).
- `/omj-fix` — baseline·verifySetup 참조 추가(캡처 SoT 재사용 규율 유지).
- `/omj-review` — Figma 충실도 검증 축 추가(figma-fidelity.md 참조).
- 커맨드 본문 SoT 상대링크(`../docs/...`) → `${CLAUDE_PLUGIN_ROOT}/docs/...` 절대화(omj.md 2곳·omj-start.md 1곳 — 런타임에서 상대링크는 소비 프로젝트 cwd 기준으로 해석돼 도달 불가였음. 스킬 본문 치환 실측 근거, 실패 시 기존 fallback 문구가 그대로 안전망).
- `docs/PRINCIPLES.md` — ①⑪(레인 질문 "최대 1회"+auto-select 정합), ⑧(번들 최소화의 경계: 외부 지식 참조 원칙은 유지하되 자작물(agents·훅 템플릿·references)은 위반 아님), ⑩(opt-in 훅과의 양립 — 상시 훅 기각은 유지, zero-hook 표어의 문자적 완화는 소유자 승인 기록). `docs/OMC-INTEGRATION.md` — "한 번만 묻고" 문구 드리프트 정정 + figma-implementer 위치 1줄.
- README EN/KO — 커맨드 표(verify 폴백·sync extract·setup 스캐폴딩), 번들 에이전트·opt-in 훅 절 신설, 의존성 표(캡처 백엔드), 트러블슈팅(편집 권한·baseline 만료) 동기화 갱신.
- 버전 `0.2.0` → `0.3.0`(plugin.json·marketplace.json 2곳).

### Removed

- (계획 단계 기각 — 코드 미반영) 디자인 시스템 하네스 원안의 `install.sh`(플러그인 설치와 이중 배포 경로), 독립 `token-checker`·`design-reviewer` 에이전트(`/omj-sync`·`/omj-review`와 중복), `protect-files`·`notify` 훅(FE 디자인 루프 밖), 상시(always-on) 플러그인 hooks.json(PRINCIPLES ⑩ 명시 기각 대안), baseline sidecar JSON(verify 권한상 저장 불가).

## [0.2.0] - 2026-07-01

### Added

- **README i18n 프론트도어** — OMC(oh-my-claudecode) 관례를 따라 `README.md`(영어 정본) + `README.ko.md`(한국어)로 이중언어화. 최상단 언어 스위처(`English | 한국어`), 3-step Quick Start, 커맨드 통합 테이블(Command·What·When·Example), `---` 챕터 구분으로 스캔성 개선.
- `docs/OMC-INTEGRATION.md` 신설 — "OMJ × OMC 통합 작업 플로우" 심화(멘탈 모델·역할 분담·게이트 규칙·A/B/C 플로우·핸드오프 제약)를 README 프론트도어에서 분리해 이관.
- docs/PRINCIPLES.md ⑪ 신설 — "물어보나 vs 그냥 한다": AskUserQuestion은 (모호+추론불가+비가역+실행중 발견) 4조건 모두일 때만. 새 프롬프트는 `/omj-sync`에만, `/omj-fix`·`/omj`·`/omj-verify`는 규칙상 배제(프롬프트 피로 방지).
- `/omj-review` — FF 통합 코드 리뷰 커맨드(read-only): 브랜치/스테이징 diff를 FF 4기준+a11y · vercel(성능/합성) · Next.js(Context7) 기준으로 검토하고 심각도(🔴/🟡/🟢) 리포트만 낸다(수정 없음). `/omj`(처방) ↔ `/omj-review`(검증) 분리.
- `/omj-setup` — 의존성 닥터: playwright-cli·공식 Figma MCP·Context7·OMC·tokens.json을 점검하고 누락 시 설치 가이드(이미 설치된 항목은 스킵). 첫 사용 전 권장.
- `/omj-fix` — 시각/동작 결함 수정 루프(능동 op): 붙여넣은 스크린샷+route의 결함을 진단·수정하고 재캡처로 확인한다. 관찰·재확인은 `/omj-verify`의 `-s=omj` 캡처 프로토콜을 **재사용**(중복 정의 없음)하고, 순수 신규는 그 사이의 Edit(+`--commit`)뿐. `/omj-verify`(읽기 점검)의 능동(write) 짝으로 지각적 결함(색·z-index·정렬)까지 커버.
- `frontend-fundamentals` `references/fe-acceptance.md` — 프로젝트별 acceptance 축을 레포 루트 `.omj/fe-context.md`에서 읽어 `/omj` 스펙·`/omj-fix` 진단에 반영하는 **메커니즘**(부재 시 graceful). **플러그인은 특정 축(다국어·모드 등)을 명명/강제하지 않는다** — 무엇을 점검할지는 프로젝트가 선언한다(범용·오픈소스 친화).

### Changed

- `/omj` Phase 2: 구현 acceptance를 "레포의 `.omj/fe-context.md`가 선언한 프로젝트별 축 반영(없으면 보편 FF 기준만)"으로 명시 — OMJ는 특정 축을 강제하지 않음(범용성). Color·Tokens의 하드코딩 토큰 경로(`shared/tokens/tokens.json`)를 "기본값 — `.omj/fe-context.md`의 `tokensPath`로 오버라이드"로 정정.
- **OMJ × OMC 게이트 의미 정합화**: OMJ × OMC 통합 플로우(현 `docs/OMC-INTEGRATION.md`)의 B 경로를 두 경로로 재서술 — (a) 구체 스펙은 `/ralph`·`/team` 직행(ralplan 스킵·승인 1회), (b) 합의는 명시적 `/ralplan`만(승인 2회). "구체 스펙이라 ralplan 게이트 즉시 통과"라는 자기모순 문구 삭제(auto-pass = ralplan 스킵이므로 시드 투입과 상호배타). 게이트 규칙(네이티브 plan = 읽기 게이트 vs OMC 자체 = 실행 게이트, 직교, OMC는 `ExitPlanMode` 미호출)과 핸드오프 제약(read-only materialize는 승인 후, `autopilot`은 `omj-*.md` 미탐지, `ralph`/`team`은 경로 명시 임베드, `~/.claude/plans` ≠ `.omc/plans`) 명문화.
- `/omj`: Next.js/Context7 라우팅 중복 서술 제거 → `frontend-fundamentals` 스킬을 SoT로 위임(드리프트 방지). Phase 2 끝에 읽기전용 라우팅 권고(inline/`/ralph`/`/team`, `/ralplan`은 모호·대규모만) 추가 — `/omj`는 advisor일 뿐 오케스트레이션 미소유.
- docs/PRINCIPLES.md: ⑤에 처방(`/omj` author) vs 검증(`/omj-review`·`/omj-verify`) 경계, ⑦에 게이트 공존 규칙 보강.
- **OMJ × OMC 통합 작업 플로우 문서화** — 계획(`/omc-plan`·`/ralplan`) → 실행(`/ralph`·`/team`·`/goal`)에서 `/omj` 스펙이 입력 매개가 되는 A/B/C 플로우. (0.2.0에서 `docs/OMC-INTEGRATION.md`로 이관 — README 프론트도어는 요약 표 + 링크만 유지.)
- `/omj-verify`·`/omj-sync` 사용법 정정: 인라인 env prefix(`JOY_BASE_URL=… /omj-verify`)는 슬래시 커맨드에 적용 안 됨 → `--base` 인자/사전 `export`로 교체. `--file <url>`은 비기능(use_figma는 활성 탭에 작동) → "대상=활성 탭"으로 명확화.
- **`/omj-sync` 대화형 재설계**: 인자 없는 `/omj-sync`가 드리프트를 클래스별(값 불일치/코드에만/Figma에만)로 묶어 방향(코드→Figma / Figma→코드 / 건너뛰기)을 `AskUserQuestion`으로 묻는 `sync` 모드로 변경(각 문항 1번=코드 권위 기본 — 값 불일치·코드에만은 코드→Figma, Figma에만은 보수적 건너뛰기 → 엔터만 치면 기존 code-wins와 동일한 안전 결과). `push`=명시적 code-wins 빠른 경로 유지, `check`=read-only 유지. allowed-tools에 `Edit`·`AskUserQuestion` 추가, Figma→코드 pull의 DTCG 참조-보존 가드레일(semantic→raw flatten 방지, 위험 시 기본 건너뛰기) 명시. 원칙을 "code→Figma 코드가 이김 단방향" → "코드가 기본 SoT, 충돌은 사용자가 방향 선택"으로 전환.
- **`/omj-review` 문구 재구성 + Plan-mode 사실 정정**: read-only(리포트만·수정 안 함)를 제약이 아니라 기능으로 앞세우고, `git diff`/`git rev-parse`는 read-only라 현재 Claude Code Plan 모드에서도 대체로 동작함을 반영("코드 리뷰가 Plan 모드에서 실행 안 됨"이라는 오해 문구 제거, 환경이 Bash를 전면 차단할 때의 폴백만 안내).
- docs/PRINCIPLES.md: ① 전제 정밀화("Plan 모드는 `Write`/`Edit`와 부작용 있는 Bash만 차단, 읽기 전용 Bash 허용"), ⑥ 전면 재작성(대화형 토큰 sync — 코드 기본 SoT + 사용자 방향 선택, "버린 대안"을 *사람 선택 없는 자동 양방향 머지*만 거부로 좁힘).
- CLAUDE.md: 문서화 규율을 양 언어 README(EN/KO) 동기화로, sync 원칙을 대화형으로, OMC 통합 상세 포인터를 `docs/OMC-INTEGRATION.md`로 갱신.
- 버전 `0.1.0` → `0.2.0`(plugin.json·marketplace.json). 이전 `[Unreleased]`의 `/omj-fix`·`/omj-review`·`/omj-setup`·fe-acceptance 항목을 `[0.2.0]`으로 확정.

### Deprecated

### Removed

### Fixed

- 자체 코드리뷰(xhigh) 반영: `/omj-fix` allowed-tools에 `Bash(command:*)` 추가·미사용 `Bash(yarn/pnpm:*)` 제거(최소권한)·세션 close 시점/스크린샷 역할 문구 명확화; `.omj/fe-context.md`의 `tokensPath` 오버라이드를 `/omj-sync`·`/omj-setup`이 존중하도록 정정; README `/omj` 섹션에 acceptance·tokensPath 반영, Context7·능동 op 목록에 `/omj-fix` 추가, 토큰 구조에 "예시(프로젝트마다 다름)" 헤지; PRINCIPLES 정본 파일 목록·`Skill` 열거·⑩ 구분선 보강 및 "축을 명명하지 않는다"→"빌트인으로 강제하지 않는다" 정정; FF 예제 제네릭화 잔재(`KakaoMap`→`MapView`, "갤러리 업로드"→"이미지 업로드") 제거. (글로벌 `apply-pr-review` 스킬의 트리아지 합성 보강은 OMJ 레포 밖이라 미기록.)
- `frontend-fundamentals` SKILL.md의 dangling `/fe-review` 참조 → 실재하는 `/omj-review` 커맨드로 정정(네임스페이스 `/omj-*` 일관). 기존엔 존재하지 않는 커맨드를 가리키는 깨진 링크였음.
- `/omj` allowed-tools: `Skill` 추가(frontend-fundamentals 루브릭 로드 가능) + figma 와일드카드를 **읽기 전용 4종**으로 축소(`use_figma` 등 write 도구 제외 → read-only/side-effect-free 보장과 일치).
- `/omj` Phase 0 디스패치: route-only 입력(`/omj /settings/profile`)이 dev/route 규칙에 동시 매칭되던 모호성 제거(route 먼저 소비, 남은 인자 없으면 사용법).
- `/omj-verify` 셸 스니펫: 빈 `$JOY_BASE_URL` → `${JOY_BASE_URL:-http://localhost:3000}` 기본값, 리터럴 `<route>` → 치환 변수 `$ROUTE`, 인증(로그인 리다이렉트) 처리를 open/goto 이후로 이동.

### Security

## [0.1.0] - 2026-06-29

### Added

- `/omj` — Plan 네이티브 프라이머. 명세 수집 + 구현 스펙(Plan)을 author 후 멈추는 read-only 커맨드.
- `/omj-verify` — playwright-cli 기반 시각 검증 커맨드.
- `/omj-sync` — tokens.json(W3C DTCG) ↔ Figma Variables 토큰 동기화. code→Figma "코드가 이김" 단방향.
- `frontend-fundamentals` 스킬 번들 (OMJ 정본).
- 문서: README, PRINCIPLES.

---

> 앞으로 모든 기능 추가/변경 시 이 파일에 항목을 추가합니다.

[Unreleased]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.7.1...HEAD
[0.7.1]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/S-jooyoung/oh-my-joy/releases/tag/v0.1.0
