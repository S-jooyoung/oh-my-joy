# CLAUDE.md — oh-my-joy (OMJ) repository operating rules

Rules for Claude sessions working in this repository. Keep it light every turn (<120 lines).

## What OMJ is

oh-my-joy (marketplace `omj`) is a standalone Claude Code plugin covering **the entire code↔Figma frontend loop plus the general-purpose workflows that wrap it** — ① design→code (publishing) ② visual verification ③ code↔Figma token sync (interactive) ④ requirement clarification (deep interview) ⑤ durable execution (goal-loop) ⑥ consensus review (ralplan). It is independent of OMC (oh-my-claudecode)/OMX (oh-my-codex) and coexists with both without conflict — OMJ owns the FE commands under `/omj*`, while general-purpose workflow commands are invoked canonically as `/oh-my-joy:<name>`. Mental model: **"FE work always starts with /omj — after the spec is approved, take execution lane option 1 `(recommended)` unless there is a specific reason not to."** An `/omj` spec becomes the input consumed by OMC/OMX execution tools (`/goal`/`$ultragoal` durable, `/team`/`$team` parallel, `/ralph`/`$ralph` sequential, `$ultraqa` QA) — the routing canon is `docs/EXECUTION-HANDOFF.md`; flow details live in `docs/OMC-INTEGRATION.md`.

## Documentation discipline (top priority)

When adding or changing a feature, update all three of the following **together** (changing only code without the docs is incomplete):

1. **README** (usage; **EN `README.md` + KO `README.ko.md` in sync**) — reflect command/flag/behavior changes. The execution-routing canon is `docs/EXECUTION-HANDOFF.md`; deeper flows in `docs/OMC-INTEGRATION.md`.
2. **CHANGELOG** (entry) — 1 change = 1 entry.
3. **docs/PRINCIPLES.md** (how it works — English, canonical) — update whenever a principle, design decision, or mental model changes, including its opening decision table.

Canonical facts (command names, the install string `/plugin install oh-my-joy@omj`) must **match across every doc and both README languages**. For narrative content such as the mental model, **README (EN/KO in sync) is canonical**; other docs only summarize/link (verbatim duplication is not required — prevents drift). README.md (EN) and README.ko.md (KO) always keep the same structure and the same canonical facts.

## Command / agent / hook rules

- Two naming axes: OMJ-specific FE loop verbs take the `/omj-*` prefix (root `/omj` excepted); **named methodology/rubric commands** (deep-interview, ff-review, goal-loop, ralplan) use an unprefixed basename + registration in the tests' `WORKFLOW_COMMANDS`. In docs and the selector, unprefixed commands are **always written as the canonical `/oh-my-joy:<name>` invocation** (bare slash notation is forbidden — test-enforced).
- v1 commands: `/omj` (Plan primer + execution lane selector; skips the question on auto-select) · `/omj-start` (post-approval OMC/OMX handoff fallback) · `/oh-my-joy:ff-review` (FF code diff review) · `/omj-verify` (playwright-cli first, MCP fallback; 3-stage baseline comparison) · `/omj-fix` (visual defect fix loop, active) · `/omj-sync` (token code↔Figma sync + extract; interactive, active) · `/omj-setup` (dependency doctor + fe-context/hook scaffolding) · `/oh-my-joy:deep-interview` (general-purpose deep interview — produces a native Plan) · `/oh-my-joy:goal-loop` (durable goal loop — validator evidence gate, active) · `/oh-my-joy:ralplan` (consensus review — one critic pass, read-only). (v1.1: `/omj-push` · `/omj-spec`.)
- New command = `commands/<name>.md` + frontmatter: `description`, `argument-hint`, `allowed-tools` (**least privilege** — two tiers: **zero-bash read-only** (omj, deep-interview, ralplan — no write tools, no Bash, no Task) / **report-only** (ff-review, omj-verify — source-non-mutating, observation-scoped Bash only). Both sets are test-enforced. Per-mode privilege differences are enforced by the body — e.g. omj-sync's "Write is extract-only"). Frontmatter `description`/`argument-hint` (commands, agents, skills alike) are English-first; Korean user-utterance trigger examples may stay in parentheses for auto-invocation matching — the language purity check covers bodies only.
- **Never declare a tool the body's procedure does not call.** Narrow Bash to the smallest runnable prefix (`Bash(npm i -g playwright-cli:*)`, not `Bash(npm:*)`). Declare MCP tools with the plugin prefix **and** the bare server variant (`mcp__figma__*` etc.) side by side — tool names differ by install source. Both rules are pinned by invariant tests (`tests/plugin-manifest.test.mjs`). Deliberately not pre-approving dangerous execution is itself a safety gate — the permission prompt becomes the user's confirmation point (PRINCIPLES ③).
- **Agents** (`agents/*.md`): 3 bundled — `figma-implementer` (an approved spec is a required input — refuses to implement a bare Figma URL, no plan-gate bypass) · `design-qa` (inspect-only, never modifies sources) · `plan-critic` (ralplan-only adversarial plan reviewer, read-only). Write a new agent's description narrowly to prevent auto-delegation misfires. Do not set a `model` field (inherits the calling session's model — intentional omission). plan-critic/design-qa tool contracts are pinned by invariant tests. Never list agents in EXECUTION-HANDOFF (the lane SoT) or the selector (they are executors, not lanes).
- **Hooks**: never ship `hooks/hooks.json` in the plugin (its existence = auto-firing across every repo the moment the plugin is enabled = the alternative PRINCIPLES ⑩ rejected). Canonical hook scripts live in `templates/hooks/*.mjs`; `/omj-setup` **copy-installs** them into consuming projects (opt-in). The scripts no-op without an fe-context declaration.
- The SoT for behavior is each `commands/*.md` body. Read that file before writing code or docs about it.

## Core design principles (summary — canonical: docs/PRINCIPLES.md)

- **Plan-native primer**: `/omj` is read-only (no Write/Edit/Bash). It gathers the spec, authors the implementation spec, then **stops** — it never writes code itself. Implementation runs after the user's ExitPlanMode approval.
- **Spec format**: uSpec section taxonomy (Anatomy/Structure/Color-tokens/Props·Variants/A11y/Motion) + Toss FF's 4 criteria (readability, predictability, cohesion, coupling) + accessibility applied to every item.
- **code↔Figma token sync**: code is the default SoT; on conflict the user picks the direction (interactive `sync`). `check` only reports drift; `push` is explicit code-wins.
- **Minimal bundling**: only the in-house `frontend-fundamentals` skill is bundled. vercel skills are referenced (`npx skills add/update`).
- **Graceful degradation**: missing figma/context7/playwright-cli/OMC/OMX is not an error — skip + guidance.
- **Prescribe vs verify / coexisting gates**: `/omj` prescribes FF knowledge (prescriptive); `/oh-my-joy:ff-review` and `/omj-verify` verify it (descriptive) — the same FF SoT at different phases. The `/omj` gate (native plan read gate) and OMC/OMX execution/goal gates are orthogonal — the default is straight to the selected lane after approval; `/oh-my-claudecode:ralplan`/`$ralplan` consensus is for ambiguous or high-risk work only (OMX `$ralplan` is currently plan-only — after consensus, start the execution lane separately). Canon: README/PRINCIPLES/EXECUTION-HANDOFF.

## Git / commits

- **No direct commits to main** — work on a branch and open a PR to main. Release tags attach to the main commit after merge.
- Conventional commits: `<type>(<scope>): <subject>` (feat/fix/chore/docs/refactor/test).
- ❌ **AI signatures, `Co-Authored-By: Claude`, "Generated with Claude Code" — never.**
- Write in English. Keep it concise.

## Meta: maintaining this file

- Update when commands/principles/integrations change. One concept = one line, **stay <120 lines**.
- No self-evident or general dev knowledge. Detailed principles live in docs/PRINCIPLES.md.
