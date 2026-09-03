# oh-my-joy design principles (PRINCIPLES)

> This document is the **canonical source** for design rationale. It explains **why** each oh-my-joy (OMJ) design decision was made. Canonical facts (README/SoT) define the "what"; this document defines the "why". Each principle is written as `problem → decision → rationale → outcome`, and where possible records the rejected alternatives and the reasons. The actual behavior of each command is canonical in `commands/spec.md`, `commands/deep-interview.md`, `commands/review.md`, `commands/verify.md`, `commands/fix.md`, `commands/sync.md`, `commands/ship.md`, and `commands/setup.md`; this document stays consistent with that behavior.

The through-line of this plugin is a single idea: **treat the tool's constraints as the design axis instead of working around them.** Claude Code's Plan mode blocks writes, so the entry-point commands were built to have no write path at all — and that turned a limitation into the review gate the workflow needed. From v0.8.0 the same idea extends past the frontend loop: OMJ is a general spec-first workflow spine, and the code↔Figma loop is its first-class specialization.

## Overview

| # | Principle | Problem it solves | Decision | Rejected alternative |
| --- | --- | --- | --- | --- |
| ① | **Plan-native primer** | Plan mode blocks `Write`/`Edit`, yet that is the mode users live in — a one-shot implement command half-works where it is invoked most | `/oh-my-joy:spec` (concrete input) and `/oh-my-joy:deep-interview` (fuzzy input) author an implementation spec and stop. That spec *is* the native Plan | A full-auto "input → code in one command": demos well, but forces implementation without review |
| ② | **Plan-first, then continuity** | Convenience and review-before-write cannot both be satisfied in one turn | Split into halves — the primer drafts, you approve, execution implements. Convenience survives as the approved plan's completion procedure, which the session follows without further prompting; only `/oh-my-joy:ship` stays manual | Immediate implementation, or a command typed per stage — the first skips review, the second makes eight commands feel like eight chores |
| ③ | **Read-only primers + least privilege** | A primer with write access both violates least privilege and opens a path around the plan gate | No `Write`/`Edit`/`Bash`/`Task` on the primers; `review` and `verify` carry only observation-scoped Bash; `ship` pre-approves only `git`/`gh`/`npx tsc` and never a test runner | Keeping the tools and instructing the model not to use them — prose is not an enforcement layer |
| ④ | **Two-track Figma strategy** | "Reading Figma" is two different jobs: screen → code, and design-system spec/token extraction | Official Dev Mode MCP for screens today, walked section by section on large frames; a console-based MCP + uSpec for design-system extraction is the planned second track (v1.1+) | One tool for both — neither job gets done well |
| ⑤ | **One rubric, two stages; two spec shapes** | Free-form specs omit a different thing every time; a rigid skeleton with no rubric is empty formalism; a frontend-only skeleton leaves general work with nothing | Frontend specs use uSpec's sections scored by the FF four criteria + a11y; general specs use goal / constraints / acceptance / verification commands. The same rubric is *prescriptive* in `spec` and *descriptive* in `review` | Prose specs, or a rubric with no fixed shape |
| ⑥ | **Interactive token sync** | Drift between code tokens and Figma variables is inevitable; picking the winner automatically breaks design systems silently | Code is the *default* source of truth, but on conflict the user picks the direction per drift class. Option 1 always follows code authority | Automatic bidirectional merge |
| ⑦ | **Spec-first handoff to native lanes + a dispatch contract** | Baking an orchestrator into a spec-authoring plugin blurs responsibility and couples it to one runner; but parallel work still needs to know who owns which file | Three lanes, all native: inline, `/goal`, Agent Teams. OMJ owns only the dispatch contract (Section · Figma node · Teammate · Owns files · Verify command) and the completion procedure, never a runtime | A bespoke orchestrator or a durable loop of OMJ's own — both retired in v0.8.0 |
| ⑧ | **Borrow methodology, not surface** | Duplicated knowledge drifts; borrowed surfaces multiply until nobody uses them | Bundle only self-authored artifacts; reference externally maintained skills; absorb external *methodologies* as credited rewrites; record what was declined and why | Vendoring skills, or adopting every good idea as one more command |
| ⑨ | **Graceful degradation** | Optional dependencies turn into hard blockers if their absence is an error | Every dependency is optional: Figma MCP, playwright, Context7, the Agent Teams flag. Absence means "skip + explain" | Hard requirements |
| ⑩ | **Mechanism in the plugin, axes and proof in the project** | The most common cause of rework is a *project-specific* omission, and no plugin can know which; "proven" also differs per project | The plugin owns only the mechanism; each project declares acceptance axes and `verifyCommands` in `.omj/fe-context.md`. No axis or command is built in | An always-on hook, or baked-in axes and test runners |
| ⑪ | **Ask rarely, and only by rule** | Scattering prompts causes fatigue; asking nothing makes the tool unilateral | Prompt only when the choice is ambiguous, has no safe default, is expensive to reverse, and depends on runtime data. Two bounded classes: the single lane question, and the interview's one-question rounds | Per-item confirmations, or silent unilateral decisions |
| ⑫ | **Prompt discipline and measurement** | Prompt bodies drift toward shouting and emphasis; "it feels better" is not evidence | Bodies follow the official prompting guide and a test pins the checkable part; behavior changes carry eval cases; the always-on token budget is a ratchet; the answer style is opt-in | Style by convention, evaluation by eyeballing |

> The "Rejected alternative" column compresses each principle's problem and reasoning from the full sections below.

---

## ① Plan-native primer — make the tool's constraint the design axis

**Problem.** Claude Code's Plan mode deliberately blocks `Write`/`Edit` and mutating `Bash`. This project's user habitually works "almost always in Plan mode". Had the entry command been "read the input and immediately implement", it would only half-work in the situation where it is actually invoked most, or force dropping out of the mode to bypass the plan gate.

**Decision.** Two primers, both read-only. `/oh-my-joy:spec` takes concrete input — a Figma link, a frontend task, or any general coding task — and authors an implementation spec. `/oh-my-joy:deep-interview` takes fuzzy input and narrows it one question per round until a spec can be written. Both stop after the spec; the spec becomes the native Plan the user reviews, and both end with the same two sections (execution lane, completion procedure). Each primer routes the other's input away: the interview's suitability gate sends already-concrete input to `spec`, and `spec` sends text with no verifiable target to the interview.

**Rationale.** "Make the weakness the design axis." Plan mode's write block is a natural gate that makes a human pause once to review the spec before code is produced. If the command feeds the gate its input instead of fighting it, the tool's constraint and the command's role point the same way.

**Outcome.** Both primers are safe to invoke in any mode. In Plan mode the spec is presented as the native Plan; in normal mode they behave identically — author, then stop.

**Rejected alternative.** A "full-auto command that goes input → code in one shot" demos brilliantly but collides with the user's working mode and forces implementation without review.

---

## ② Plan-first, then continuity — one entry, one approval, one ship

**Problem.** Two values collide: the convenience of "one command, straight to implementation", and the safety of a human reviewing the spec before code is written. A second problem arrived with the general spine: with eight commands, a workflow that needs one typed per stage is correct and exhausting.

**Decision.** Plan-first wins, and convenience is redefined twice. First, the primer authors the spec (½) → the user approves → implementation executes (½). Second, the approved plan ends with a **completion procedure** — implement on the selected lane → `/oh-my-joy:review` → `/oh-my-joy:verify` → (frontend) `/oh-my-joy:fix` while defects remain → report with evidence — and the session follows it after approval by invoking the commands as skills. Only `/oh-my-joy:ship` is typed by the user, because pushing and opening a PR are visible to others. The daily loop is "enter once, approve, ship".

**Rationale.** Frontend and backend implementation alike are expensive to unwind once poured out, and a single review sharply reduces that cost. Running review and verify after approval is not "implicit verification": the user approved the section that says they run. Keeping ship manual keeps the one outward-facing step under a human hand.

**Outcome.** The user always sees and approves "what will be built, how, and how it will be checked" first, and types two things per task instead of eight. Every command remains available standalone (someone else's diff, a re-check, tokens only).

---

## ③ Read-only primers + post-approval execution — least privilege and no plan-gate bypass, at once

**Problem.** The more powerful a command, the greater two risks: least-privilege violation, and a quiet path around the plan gate.

**Decision.** The primers declare no `Write`/`Edit`/`Bash`/`Task` (pinned by `tests/plugin-manifest.test.mjs` as the zero-bash tier). `/oh-my-joy:review` and `/oh-my-joy:verify` are the report-only tier: no write tools, observation-scoped Bash. `/oh-my-joy:ship` pre-approves only `git`, `gh`, and `npx tsc` and never a test runner. `allowed-tools` is a *pre-approval* list, so an unlisted tool surfaces a permission prompt rather than acting silently; Plan mode supplies the hard block on writes.

**Rationale.** Removing the permission achieves both goals at once: the permission surface is minimized, and the path around the gate disappears. For `ship` and evidence mode in `verify`, the permission prompt on a project's test command *is* the design — that confirmation is what makes the recorded evidence trustworthy, and pre-approving a runner would launder a narrow grant into arbitrary execution.

**Boundary with upstream skills.** The official figma plugin's `figma-design-to-code` skill asks to be loaded before any `get_design_context` call, but `/oh-my-joy:spec` knowingly does not load it while priming — that skill presumes implementation, and loading implementation-steering guidance into a read-only primer erodes the plan-gate identity. Upstream compliance belongs to the implementation stage (a decision, not a bug).

---

## ④ Two-track Figma strategy — different Figma tools for different jobs, and sections for large frames

**Problem.** "Reading Figma" is two jobs: design→code for app screens, and design-system spec/token extraction. A third problem appeared in practice: a large frame read in one `get_design_context` call comes back flattened and truncated, which is exactly where the spec loses fidelity.

**Decision.** Track (a), app screens, uses the official Dev Mode MCP. Large frames are walked section by section: `get_metadata` enumerates the root's top-level children; three or more switches `spec` into section mode (one `get_design_context` per section, a per-section spec, and disjoint target files per section); more than eight proposes a split. Track (b), design-system extraction, remains the planned figma-console-mcp + uSpec path (v1.1+).

**Rationale.** Accuracy comes from reading at the right granularity, not from parallelism. Reading sections in sequence keeps the primer read-only (it never needs subagents), while the section → file mapping it produces is precisely what the agent-team lane needs to parallelize implementation afterwards (see ⑦).

**Rejected alternative.** Letting `spec` spawn read-only subagents to read sections in parallel. Subagents do not inherit the parent's `allowed-tools`, so one `Task` declaration voids the read-only contract at the manifest level.

---

## ⑤ One rubric, two stages; two spec shapes

**Problem.** Free prose specs omit a different item every time; a rigid skeleton with no rubric is empty formalism; and once OMJ covers general work, a frontend-only skeleton leaves backend, scripts, and tooling with no shape at all.

**Decision.** Frontend specs borrow uSpec's section taxonomy — Anatomy / Structure / Color·Tokens / Props·Variants / A11y / Motion — and evaluate every section with the frontend-fundamentals four criteria (readability, predictability, cohesion, coupling) plus accessibility, with the fidelity rules on the Figma track. General specs use a plainer skeleton: goal, constraints, target files and reuse, acceptance criteria, verification commands, non-goals. The same FF rubric is *prescriptive* in `/oh-my-joy:spec` and *descriptive* in `/oh-my-joy:review`; `review` sorts files into frontend (FF rubric) and general (correctness, simplicity, consistency, test coverage) and checks the spec's acceptance criteria on both.

**Rationale.** uSpec (Uber) is a section system proven in design-spec automation and dependency-free; the FF criteria give each section a concrete quality gate. The general skeleton mirrors what the interview already produces, so both primers hand the same shape to the same reviewer.

**Outcome.** Every spec has a fixed shape for its kind; review cost stays low; the reviewer verifies the promises the plan made instead of re-deriving them.

---

## ⑥ Token sync — code is the default SoT; conflicts get a user-chosen direction

**Problem.** When tokens live in both code and Figma Variables, drift is inevitable and conflict resolution is expensive — decided automatically and wrongly, the design system silently diverges; pinned one way, a designer's legitimate change has no path back.

**Decision.** Code is the default source of truth, but on conflict the user picks the direction. `/oh-my-joy:sync check` is a read-only report; `/oh-my-joy:sync` groups drift by class (value mismatch / code-only / Figma-only) and asks once, with option 1 following code authority; `push` is the explicit code-wins fast path; pulls preserve DTCG references so semantics are never flattened into raw hex.

**Rejected alternative.** Automatic bidirectional merge — the permanent conflict-resolution debt comes from auto-merging, not from having directions.

---

## ⑦ Spec-first handoff to native lanes — plus the one contract OMJ owns

**Problem.** A spec-authoring plugin that also owns execution orchestration blurs responsibility and couples itself to one runner. Yet parallel implementation of a large frame needs a contract: who owns which files, what counts as done, when the lead checks.

**Decision.** Three lanes, all native to Claude Code: **inline** (default; `figma-implementer` is the frontend executor), **`/goal`** (in-session iteration until a condition holds), and **agent team** (native Agent Teams, enabled with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; without the flag the lane degrades to subagents, then to inline). OMJ contributes two things and no runtime: the **dispatch contract** — a section-mode spec ends with a `Section | Figma node | Teammate | Owns files | Verify command` table whose rows are the shared task list, with disjoint file ownership because teammates editing one file overwrite each other, and `figma-implementer` reusable as the teammate type — and the **completion procedure**, with `verify` as the barrier after teammates finish. Routing rules and thresholds live only in [`docs/EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md).

**Rationale.** Iteration and parallelism are the platform's job; what the platform cannot know is which section maps to which files and what evidence "done" requires. That knowledge is produced by the spec, so the spec carries it.

**Retired in v0.8.0.** The durable goal loop (`goal-loop`, a state-file validator and a fourth lane) and the consensus pass (`ralplan`, with the `plan-critic` agent) overlapped with native Plan mode and `/goal` and cost a command each. Their one irreplaceable idea — no completion without evidence — moved into `verify` (evidence mode), `ship`, and the teammate contract; their names stay in the README migration table for one minor release.

**Gate-coexistence rule.** The primers use Plan mode as a *read* gate; `/goal` owns its *execution* gate. They are orthogonal and meet only at approval. "It's big" alone never forces a second planning gate; fuzzy work goes to `/oh-my-joy:deep-interview` before the spec, not to a review after it.

---

## ⑧ Borrow methodology, not surface — reference, absorb, decline

**Problem.** The more a plugin bundles, the heavier it gets and the more places one fact lives. The opposite failure is subtler: every good idea in the ecosystem becomes one more command, until the plugin is a catalog nobody navigates.

**Decision.** Three tiers. **Bundle** only self-authored artifacts OMJ owns and maintains: the `frontend-fundamentals` skill and its `references/`, the two agents, the hook templates, the answer style, the eval cases. **Reference** externally maintained knowledge (the vercel skills: `npx skills add vercel-labs/agent-skills/…`). **Absorb** external *methodologies* — stage structures, gates, output contracts, writing rules — as self-authored rewrites under three conditions: credit the source and license in `NOTICE.md`, write new sentences, port no runtime. And **record what was declined** so the same idea is not re-litigated every release.

**The v0.8.0 adoption table.** Sources are credited in `NOTICE.md`; the team-mode source is named there rather than here.

| Idea | Source | Where it landed | Verdict |
| --- | --- | --- | --- |
| Team pipeline contract (shared task list, verify as barrier) | the team-mode source credited in `NOTICE.md` | the dispatch table + completion procedure on the agent-team lane | adopted |
| Verification before completion (no "done" without evidence) | superpowers | `verify` evidence mode, `ship`, teammate completion messages | adopted |
| Artifact chaining (each stage reads the previous stage's output) | gstack | `spec` records route, verification commands, section → file mapping; `review`, `verify`, `ship` read them | adopted |
| A ship stage (tests → commit → push → PR) | gstack | `/oh-my-joy:ship`, kept manual | adopted |
| Eval harness (capability vs regression cases, pass@k thresholds) | everything-claude-code | `evals/` on native `claude plugin eval` with a fallback runner; `docs/EVALS.md` | adopted |
| Fluent, natural answers in the user's language; explain for beginners | fluent-korean | `output-styles/oh-my-joy.md` (opt-in) | adopted |
| Brainstorming, plan writing, real-browser QA | superpowers, gstack | already covered by `deep-interview`, `spec`, `verify`, `fix` | already present |
| Continuous learning (auto-extracting skills from sessions) | everything-claude-code | — | declined: surfaces would grow on their own |
| Safety-guard commands (`careful`, `freeze`, `guard`) | gstack, everything-claude-code | — | declined: permission modes and Plan mode already do this |
| TDD as a bundled skill | superpowers, everything-claude-code | a project axis in `.omj/fe-context.md`, if the project wants it | declined: the plugin forces no axis (⑩) |
| Large agent rosters with model matrices | the team-mode source | — | declined: agents are executors; more of them means more auto-delegation misfires |
| Session retro / memory commands | gstack | — | declined: session memory is the platform's; CHANGELOG and eval results are the record |

**Outcome.** OMJ stays at eight commands, two agents, one skill, one style. Upstream tools update themselves; absorbed methodologies have no upstream to drift from; declined ideas have a written reason.

---

## ⑨ Graceful degradation — a missing dependency is a skip + guidance, not an error

**Problem.** OMJ leans on optional dependencies — the Figma Dev Mode MCP, playwright-cli, Context7, and now the experimental Agent Teams flag. If a command dies when any one is missing, users face a plugin where nothing works until everything is installed.

**Decision.** Every dependency is optional; absence is handled as skip + guidance. Without the Figma MCP, "proceeding without the link contents". Without Context7, the docs lookup is skipped. Without a capture backend, browser mode says so and stops. Without the Agent Teams flag, the agent-team lane degrades to subagents, then to inline, and the spec's copyable action stays valid because it is plain language.

**Outcome.** OMJ works meaningfully in a minimal environment and grows as tools are added; `/oh-my-joy:setup` reports what is missing and offers each item as opt-in.

---

## ⑩ Mechanism in the plugin, axes and proof in the project

**Problem.** The most frequent cause of rework is *systematic omission* from project-specific conditions (locales, theme modes, currency rules), and "what proves this works" also differs per project. Baking either into the plugin would make it false for other users.

**Decision.** The plugin owns only the mechanism. Each project declares acceptance axes, `contextDocs`, `decisions`, `verifySetup`, and now `verifyCommands` in `.omj/fe-context.md` (format canon: `references/fe-acceptance.md`). `/oh-my-joy:spec` folds the axes into specs; `/oh-my-joy:verify` (evidence mode) and `/oh-my-joy:ship` run the declared commands and record evidence; without the file, only universal criteria apply and the commands fall back to `package.json` scripts, stopping with guidance when nothing exists rather than inventing a command.

**Rationale — two rejected alternatives.** An always-on hook injecting a checklist into every edit breaks the zero-hook design and fires in every repo; baking axes or runners into the shared rubric makes them noise for every other project. The opt-in hook templates in `templates/hooks/` do not overturn this: the plugin ships no `hooks.json`, `/oh-my-joy:setup` copy-installs them only on consent, they no-op without a declaration, and they fail open (pinned by `tests/hooks/hook-conventions.test.mjs`).

**Extension into an active verification op — `/oh-my-joy:fix`.** Perceptual defects visible only in screenshots cannot be caught by static acceptance, so `fix` observes (the `verify` capture protocol), edits, and re-captures — the only genuinely new part is the edit between the two looks.

---

## ⑪ Ask vs just do — don't spray AskUserQuestion

**Problem.** Misapplying "give the user choices" makes every command pop a modal; asking nothing makes the tool unilateral.

**Decision.** OMJ asks via `AskUserQuestion` only when all four hold: the choice is genuinely ambiguous, no safe default can be inferred, being wrong is expensive to reverse, and the choice depends on data discovered during execution. Otherwise a flag (`--commit`), an advisory line, or just doing it. Two bounded interaction classes remain: the primers may ask the lane question exactly once, and only when a lane heavier than inline is recommended (inline auto-selects and Plan approval is the consent); and `/oh-my-joy:deep-interview` asks one question per round, because each round's question depends on the previous answer, under a 20-round cap with early exit from round 3.

**Where nothing is asked.** `/oh-my-joy:ship` and `verify` in evidence mode ask no questions of their own — the permission prompts on the verification commands are the confirmation points, by design (③). `/oh-my-joy:sync` asks once per drift class and `sync extract` confirms overwrites, both satisfying the four conditions. `/oh-my-joy:setup` batches its "install now?" into one multi-select.

---

## ⑫ Prompt discipline and measurement — follow the guide, pin it, measure it

**Problem.** Command bodies are prompts, and prompts drift: emphasis inflates (bold everywhere, `MUST`/`NEVER` in capitals, warning glyphs), rules lose their reasons, and examples blur into instructions. Current models overtrigger on shouted instructions, so the drift is not cosmetic. And whether a rewrite made a command better was, until v0.8.0, a matter of taste.

**Decision.** Bodies follow the official Anthropic prompting guide — state what to do and why; prefer positive instructions; separate examples with `<example>` tags; keep emphasis rare — and `tests/prompt-style.test.mjs` pins the mechanically checkable part (no shouted imperatives, a bold budget, no callout glyphs, no principle-number pointers, wrapped examples). `tests/token-budget.test.mjs` ratchets the always-on description cost so surfaces cannot grow silently. `evals/` holds behavioral cases per command run through native `claude plugin eval` (with `scripts/eval-runner.mjs` as the fallback until early access is enabled), and a behavior change in a body adds or updates a case ([`docs/EVALS.md`](EVALS.md)). The answer style (`output-styles/oh-my-joy.md`) follows the same discipline and is opt-in: `keep-coding-instructions: true`, never `force-for-plugin`.

**Rationale.** A rule that lives only in a review checklist holds for one release. A test holds. An eval turns "this reads better" into a score with a baseline.

**Outcome.** Every body reads as instructions with reasons; the plugin's cost per session is a number under test; and a future rewrite of any command is compared against a recorded run instead of a memory.

---

## What each principle looks like in the repo

- ① ③ — [`commands/spec.md`](../commands/spec.md) and [`commands/deep-interview.md`](../commands/deep-interview.md) frontmatter: no `Write`, no `Edit`, no `Bash`, no `Task`. [`commands/ship.md`](../commands/ship.md): git/gh/typecheck only.
- ② ⑦ — [`docs/EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md): the three lanes, the dispatch contract, the completion procedure; `tests/standalone.test.mjs` pins the lane set, the Agent Teams flag, and the fallback chain.
- ⑤ — [`commands/review.md`](../commands/review.md): two file classes, one rubric, acceptance criteria checked against the diff.
- ⑥ — [`commands/sync.md`](../commands/sync.md): drift grouped into three classes, one batched question, reference-preserving pulls.
- ⑧ — [`NOTICE.md`](../NOTICE.md): every absorbed methodology and its license; the adoption table above.
- ⑨ ⑩ — every command's preflight ends in "skip + guide"; [`templates/hooks/`](../templates/hooks) scripts no-op unless the project declares the relevant key; `verifyCommands` in `references/fe-acceptance.md`.
- ⑫ — [`tests/prompt-style.test.mjs`](../tests/prompt-style.test.mjs), [`tests/token-budget.test.mjs`](../tests/token-budget.test.mjs), [`evals/`](../evals), [`output-styles/oh-my-joy.md`](../output-styles/oh-my-joy.md).

---

## Sources

- uSpec (Uber): https://www.uber.com/ca/en/blog/automate-design-specs/ · https://docs.uspec.design/
- figma-console-mcp (Southleft): https://github.com/southleft/figma-console-mcp
- frontend-fundamentals: Toss FF four criteria (readability, predictability, cohesion, coupling) — OMJ's self-authored bundled canon
- Anthropic prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Claude Code Agent Teams, output styles, plugin evals: https://code.claude.com/docs
- Absorbed methodologies (superpowers, gstack, everything-claude-code, fluent-korean, the team-mode source): credited with licenses in [`NOTICE.md`](../NOTICE.md)
- Official Figma Dev Mode MCP / Context7 (`/vercel/next.js`) / playwright-cli — all optional dependencies

> Rule: this document is the canonical source. Write it in English; do not add AI signatures. Keep command names and install strings consistent with `commands/*.md`/README (SoT); for narrative content such as the mental model, the **README is canonical** and this document summarizes/links.
