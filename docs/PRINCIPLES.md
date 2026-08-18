# oh-my-joy design principles (PRINCIPLES)

> This document is the **canonical source** for design rationale. It explains **why** each oh-my-joy (OMJ) design decision was made. Canonical facts (README/SoT) define the "what"; this document defines the "why". Each principle is written as `problem → decision → rationale → outcome`, and where possible records the rejected alternatives and the reasons. The actual behavior of each command is canonical in `commands/spec.md`, `commands/ff-review.md`, `commands/verify.md`, `commands/fix.md`, `commands/sync.md`, `commands/setup.md`, `commands/deep-interview.md`, `commands/goal-loop.md`, and `commands/ralplan.md`; this document stays consistent with that behavior.

The through-line of this plugin is a single idea: **treat the tool's constraints as the design axis instead of working around them.** Claude Code's Plan mode blocks writes, so the entry-point command was built to have no write path at all — and that turned a limitation into the review gate the workflow needed.

## Overview

| # | Principle | Problem it solves | Decision | Rejected alternative |
| --- | --- | --- | --- | --- |
| ① | **Plan-native primer** | Plan mode blocks `Write`/`Edit`, yet that is the mode users live in — a one-shot implement command half-works where it is invoked most | `/oh-my-joy:spec` collects the design spec, authors an implementation spec, and stops. That spec *is* the native Plan | A full-auto "Figma → code in one command": demos well, but forces implementation without review |
| ② | **Plan-first over convenience** | Convenience and review-before-write cannot both be satisfied in one turn | Split into two halves — primer drafts, you approve, execution implements. Convenience survives as continuity *after* the gate | Immediate implementation: saves little, and bad frontend abstractions are expensive to undo |
| ③ | **Read-only command + least privilege** | A command with write access both violates least privilege and opens a path around the plan gate | Remove `Write`/`Edit`/`Bash` from `/oh-my-joy:spec` entirely. `allowed-tools` is a *pre-approval* list, so an unlisted tool surfaces a permission prompt rather than acting silently; Plan mode supplies the hard block on `Write`/`Edit`. The official figma skill's mandatory pre-load before `get_design_context` is knowingly **not** followed during priming — that skill presumes implementation, which would erode the read-only plan gate; upstream guidance applies at the post-approval implementation stage instead (a decision, not a bug) | Keeping the tools and instructing the model not to use them — prose is not an enforcement layer |
| ④ | **Two-track Figma strategy** | "Reading Figma" is two different jobs: screen → code, and design-system spec/token extraction | Official Dev Mode MCP for screens today; a console-based MCP + uSpec for design-system extraction is the planned second track (v1.1+, not yet shipped) | One tool for both — neither job gets done well |
| ⑤ | **uSpec skeleton × quality rubric** | Free-form specs omit a different thing every time; a rigid skeleton with no rubric is empty formalism | Borrow uSpec's section taxonomy for structure, score each section with the FF four criteria + a11y. The same rubric is *prescriptive* at authoring time (`/oh-my-joy:spec`) and *descriptive* at verification time (`/oh-my-joy:ff-review`, `/oh-my-joy:verify`) — one source, two stages | Prose specs, or a rubric with no fixed shape |
| ⑥ | **Interactive token sync** | Drift between code tokens and Figma variables is inevitable; picking the winner automatically breaks design systems silently | Code is the *default* source of truth, but on conflict the user picks the direction per drift class. Option 1 always follows code authority, so pressing enter stays safe | Automatic bidirectional merge — that is where the permanent conflict-resolution debt comes from |
| ⑦ | **Spec-first handoff to execution lanes** | Baking execution orchestration into a spec-authoring plugin blurs responsibility and couples it to any one runner | The approved spec is the handoff artifact; execution runs on one of four lanes — inline (default), native `/goal` (in-session iteration), native agent team (parallel subagents), or the plugin's own `/oh-my-joy:goal-loop` (durable, evidence-gated). The plan gate (read) and the goal gates (execution) are orthogonal and meet only at approval | Building a bespoke orchestrator into the plugin — the native lanes already iterate and parallelize well; OMJ owns only the lane that needs its evidence contract (goal-loop) |
| ⑧ | **Bundle only what you own** | Duplicated knowledge drifts from its upstream and doubles maintenance | Bundle the self-authored quality skill; *reference* externally maintained skills instead of vendoring them. External *methodologies* (not tools) may be absorbed as self-authored rewrites — source credited in `NOTICE.md`, no sentence copying, no runtime porting; re-porting on upstream updates is a manual owner decision. `/oh-my-joy:deep-interview` was the first case; `/oh-my-joy:goal-loop` (durable goal loop whose only pre-approved write path is the `goal-state.mjs` validator) and `/oh-my-joy:ralplan` (consensus review via the bundled read-only `plan-critic` agent) followed | Vendoring third-party skills — stale within one upstream release |
| ⑨ | **Graceful degradation** | Optional dependencies (Figma MCP, playwright, Context7) turn into hard blockers if their absence is an error | Every dependency is optional: absence means "skip + explain", never a crash | Hard requirements — turns a plugin into a setup project and kills day-one value |
| ⑩ | **Mechanism in the plugin, axes in the project** | The most common cause of rework is a *project-specific* omission (locales, theme modes, currency), and no plugin can know which | The plugin owns only the mechanism; each project declares what to check in `.omj/fe-context.md`. No axis is built in. Purely perceptual defects that no static rule can catch (colour, z-index, alignment) get an active loop instead — `/oh-my-joy:fix` observes, edits, re-captures | (a) An always-on hook firing in every repo; (b) baking specific axes into the shared rubric. Both break portability |
| ⑪ | **Ask rarely, and only by rule** | Scattering prompts causes prompt fatigue; asking nothing makes the tool decide unilaterally | Prompt only when all four hold: genuinely ambiguous, no safe default, expensive to reverse, *and* dependent on data discovered at runtime. Otherwise use a flag, print advice, or just do it. Two bounded interaction classes: (a) after the spec is written `/oh-my-joy:spec` may ask exactly once to pick the execution lane — skipped when the recommendation is inline; (b) the interview class — `/oh-my-joy:deep-interview` asks one question per round because each round re-satisfies all four conditions on data the previous answer just produced, bounded by a 20-round hard cap, early exit from round 3, and a suitability gate that refuses interviews for already-clear inputs | Per-item confirmation prompts, or silent unilateral decisions |

> The "Rejected alternative" column compresses each principle's problem and reasoning from the full sections below; only ①⑥⑩ state a rejected alternative as an explicit paragraph there.

---

## ① Plan-native primer — make the tool's constraint the design axis

**Problem.** Claude Code's Plan mode deliberately blocks `Write`/`Edit` and mutating `Bash` (read-only Bash — e.g. `git diff` — is generally allowed). So while in Plan mode, no command can write code directly. Yet this project's user habitually works "almost always in Plan mode". Had `/oh-my-joy:spec` been designed as a "single command that reads Figma and immediately implements code", it would only half-work in the situation where it is actually invoked most (Plan mode), or it would force an unnatural flow of dropping out of the mode to bypass the plan gate.

**Decision.** `/oh-my-joy:spec` is designed not as an "implementation command" but as a **Plan-native primer**. `/oh-my-joy:spec` collects the spec (reading Figma/code), authors an **implementation spec** with FF and vercel guidance applied, then **stops**. That spec becomes the native Plan the user reviews. Once the user approves via `ExitPlanMode`, normal execution takes over the implementation. The direct expression of this decision is that `allowed-tools` in `commands/spec.md` is limited to `Read, Grep, Glob, Skill, AskUserQuestion, figma MCP, context7 MCP` with Write/Edit/Bash absent. `AskUserQuestion` is not a source-writing tool but a bounded exception used **at most once** to settle the execution-lane handoff after the spec is complete (⑪ — if the recommendation is inline, skip the question and record `(auto)`; the rule's canon is `docs/EXECUTION-HANDOFF.md`).

**Rationale.** "Make the weakness the design axis." Plan mode's write block is not an obstacle to overcome but a natural gate that makes a human pause once to review the spec before code is produced. If the command feeds the gate its input (= a good Plan) instead of fighting it, the tool's constraint and the command's role point in exactly the same direction.

**Outcome.** `/oh-my-joy:spec` is safe to invoke whatever mode the user is in. In Plan mode the spec is presented as the native Plan; in normal mode it behaves identically — "author the spec, then stop" — so it is consistent. Users keep their habits; no mode switching required.

**Rejected alternative.** A "full-auto command that goes Figma → code in one shot" demos brilliantly but collides with the user's actual working mode and forces implementation without review. This ties directly into ②'s trade-off and was rejected.

---

## ② Plan-first over convenience — redefining the trade-off

**Problem.** Two values collide: (a) the **convenience** of "one command, one shot, straight to implementation", and (b) the **plan-first safety** of a human reviewing the spec before code is written. Satisfying both sequentially in a single turn is impossible in the first place because of the Plan-mode constraint (①). One must take priority.

**Decision.** **Plan-first wins.** Convenience is not abandoned but **redefined** — decomposed into two halves: "the primer authors the spec (½) → the user approves → implementation executes (½)", reframing convenience as "natural continued execution after approval".

**Rationale.** Frontend implementation is expensive to unwind once code is poured out (wrong abstractions, unused tokens, missing a11y), and a single review sharply reduces that cost. Conversely, the time saved by "immediate implementation without review" is small. With such asymmetric payoff, defaulting to safety is rational.

**Outcome.** The user always sees and approves "what will be built, and how" first. After approval the main session implements the spec, and for larger work it can opt into a heavier execution lane (`/goal` · agent team · `/oh-my-joy:goal-loop`) — a *handoff of an approved spec*, not an autonomous planner (see ⑦). Convenience survives as "continuity behind the approval gate".

---

## ③ Read-only command + post-approval execution — least privilege and no plan-gate bypass, at once

**Problem.** The more powerful a command (holding Write/Edit/Bash), the more convenient — and the greater two risks: (a) least-privilege violation — a spec-collection stage has no reason to hold file-writing or shell-execution rights; (b) plan-gate bypass — if the command can write, a path exists that effectively skips Plan mode's review gate.

**Decision.** `/oh-my-joy:spec` is pinned **read-only with respect to source code**. `allowed-tools` drops Write/Edit/Bash and allows only `Read, Grep, Glob, Skill`, read-oriented MCPs (figma, context7), and one `AskUserQuestion` for the execution-lane handoff. `commands/spec.md` declares explicitly that it "does not create or modify code files, does not run builds/tests/verification, and does not delegate implementation to subagents".

**Rationale.** Making it read-only achieves both goals at once. The permission surface is minimized (least privilege) so the command cannot touch files unintentionally, and the quiet path around the plan gate disappears. "Removing the permission" becomes identical to "enforcing the safety gate".

**The precise strength of the enforcement.** `allowed-tools` is a *pre-approval list*, not a hard block — attempting a tool not on the list **surfaces a permission prompt to the user** (which is why `goal-loop` deliberately not declaring `Task` is itself a confirmation gate — the spawn-time prompt is the user's consent point). The hard block is Plan mode's job (`Write`/`Edit`). The two layers overlap so that "silent writes" become impossible; no single manifest physically blocks anything. The README (EN/KO) and row ③ of the overview table above follow this wording.

**Outcome.** `/oh-my-joy:spec` is guaranteed side-effect-free on source code in every situation. Implementation happens only after user approval, on a separate execution path (main session/executor). Verification (`/oh-my-joy:verify`) depending on Bash is split into its own command for the same philosophy — a read-only primer and side-effectful verification are never mixed in one command.

**Boundary with upstream skills (the same principle applied).** The official figma plugin's `figma-design-to-code` skill mandates loading itself before any `get_design_context` call, but `/oh-my-joy:spec` priming **knowingly does not follow it** — that skill presumes implementation, and loading implementation-steering guidance into a read-only primer erodes the plan-gate identity. Upstream compliance belongs to the post-approval implementation stage (codified in `commands/spec.md` Phase 1 — a decision, not a bug; do not revert).

---

## ④ Two-track Figma strategy — different Figma tools for different jobs

**Problem.** "Reading Figma" is really two different jobs. (a) **design→code for app screens** — the layout/dimensions/structure of a specific frame must be converted into a precise code spec. (b) **Documenting design-system component specs and tokens** — variable definitions, component variant structures, and token systems must be extracted. The two jobs need different data and different tool surfaces; forcing one tool to do both does neither well.

**Decision.** Split into **two tracks**. (a) App-screen design→code uses the **official Figma Dev Mode MCP** (`mcp__plugin_figma_figma__get_design_context`/`get_screenshot`/`get_variable_defs`). (b) Design-system spec/token extraction uses the **figma-console-mcp (Southleft) + uSpec (Uber)** combination (v1.1+ roadmap).

**Rationale.** The official Dev Mode MCP is provided and backed by Figma itself, so it has the highest accuracy and stability for screen→code conversion, and provides baseline screenshots and variable definitions first-class. Deep component-level spec extraction and console-driven manipulation exceed the official MCP's scope, so tools specialized for that area — figma-console-mcp (https://github.com/southleft/figma-console-mcp) and the uSpec format standard — fit better.

**Outcome.** Each track plays to its strength. v1's `/oh-my-joy:spec` relies on track (a) for stable app-screen priming; track (b) expands into automatic component spec generation in `/oh-my-joy:ds-spec` (v1.1+). Keeping the tracks unmixed lets each evolve independently.

**Graceful reinforcement.** If the official Figma MCP is not installed or the desktop is not connected, this is **not treated as an error** — the user is guided with "Figma not connected — proceeding with a manual spec" (see ⑨).

---

## ⑤ Borrowed uSpec sections + FF integration — a proven spec skeleton wearing a quality rubric

**Problem.** Writing an "implementation spec" as free prose omits a different item every time (a11y one day, responsive breakpoints the next). Specs need a **reproducible skeleton**. At the same time, if the content filling that skeleton is not judged against a **quality standard**, the result is an empty spec with good formatting.

**Decision.** Borrow **uSpec's section taxonomy** as the spec skeleton — Anatomy / Structure / Color·Tokens / Props·Variants / A11y / Motion (`commands/spec.md` Phase 2). Then evaluate each section with the **frontend-fundamentals four criteria (readability, predictability, cohesion, coupling) + accessibility**. The FF skill's `references/` serve as the rubric.

**Rationale.** uSpec (Uber, https://docs.uspec.design/ · https://www.uber.com/ca/en/blog/automate-design-specs/) is a section system proven in practice for design-spec automation, and it can be borrowed **dependency-free** (it mandates no specific tool). Borrowing just the section taxonomy guarantees spec completeness, and layering the FF criteria on top makes each section pass concrete quality gates like "predictability = no name≠behavior", "coupling = avoid props drilling", "tokens = no raw hex". The key move is separating and then combining skeleton (uSpec) and evaluation (FF).

**Outcome.** Every `/oh-my-joy:spec` spec has the same six sections, each reviewed against the same quality yardstick. The Plan the user approves always has the same shape, keeping review cost low, and the implementer (human/executor) receives a spec with no blanks. The **no-overdesign** rule ("abstract only when things will certainly change together") is also stated at this stage, so specs do not encourage unnecessary layers.

**Prescribe-vs-verify boundary.** The same FF SoT is used differently by *stage* — `/oh-my-joy:spec` **prescribes** "what to build" against FF criteria at spec-authoring time, while `/oh-my-joy:ff-review` (code diff) and `/oh-my-joy:verify` (visual) **verify** that the implementation honored those criteria. The FF skill (`references/`) is a single SoT and prescribe/verify simply invoke it at different stages, so quality knowledge is managed in one place without being locked into the `/oh-my-joy:spec` body (no drift). This is why "collecting design input and applying FE knowledge together in `/oh-my-joy:spec` is correct layering, not a coupling smell" — downstream execution lanes are domain-neutral and carry no FE knowledge, so prescription must live upstream in `/oh-my-joy:spec`.

---

## ⑥ Token sync — code is the default SoT; conflicts get a user-chosen direction (interactive resolution)

**Problem.** When tokens live in both code (`tokens.json`) and Figma Variables, drift is inevitable and conflict resolution is expensive — if "who is the truth" gets decided automatically and wrongly, the design system silently diverges. But if the plugin pins the direction one way (code always wins), a designer's legitimate change starting in Figma has no path back into code, gutting the tool's usefulness as a general-purpose plugin.

**Decision.** **Code is the "default" SoT, but on conflict the user picks the direction.** `/oh-my-joy:sync check` remains a read-only drift report; the new default mode `/oh-my-joy:sync` (sync) groups drift **by class (value mismatch / code-only / Figma-only)** and asks the direction (code→Figma / Figma→code / skip) in a single batched `AskUserQuestion`, then applies it. `/oh-my-joy:sync push` stays as the non-interactive fast path that explicitly chooses "code wins".

**Rationale.** The real reason conflicts are expensive is not *that a direction exists* but *that the direction gets chosen automatically and wrongly*. Once a human picks per class, the ambiguity dies on the spot; and option 1 (the default) of each question is set to code authority (value-mismatch and code-only default to "code→Figma", Figma-only defaults to a conservative "skip"), so absent-mindedly pressing enter yields the same safe result as the old one-way sync — the debt came from *auto-merging*, not from having directions.

**Outcome.** Code remains the default truth, yet Figma-originated changes are absorbed into code under user approval. Figma→code pulls **preserve the DTCG reference structure** (semantic aliases are not flattened into raw hex, and if a reference would break, the default "skip" prevents it), keeping the W3C DTCG standard and its interoperability intact.

**Rejected alternative.** *Automatic bidirectional merge with no human choice* stays rejected — the permanent debt of conflict-resolution UX comes from there. Interactive choice + "code by default" delivers bidirectional usefulness without that debt.

---

## ⑦ Spec-first handoff to execution lanes — keep the boundary sharp

**Problem.** A spec-authoring plugin that also tries to own execution orchestration blurs the responsibility boundary ("when to use what") and couples the plugin to whichever runner it embeds. Execution styles legitimately differ per task — one-shot, iterate-until-done, parallel fan-out, durable multi-session — and no single built-in runner serves them all.

**Decision.** OMJ stays a **spec-authoring plugin**; the approved spec is the handoff artifact consumed by an **execution lane**. There are four lanes: **inline** (default — the current session implements, with `figma-implementer` as the standard FE executor), Claude Code's native **`/goal`** (persistence within a session — iterate until a stated condition holds), Claude Code's native **agent team** (parallel subagents for 2+ independent lanes), and OMJ's own **`/oh-my-joy:goal-loop`** (persistence across sessions with a validator evidence gate — the one lane OMJ must own itself, per ⑧'s absorption rule). The relationship is fixed in a one-sentence mental model — **"FE work always starts with /oh-my-joy:spec — after the spec is approved, take execution lane option 1 `(recommended)` unless there is a specific reason not to."** `/oh-my-joy:spec` leaves an execution-lane selector at the end of the spec, but delegates the routing rules to [`docs/EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md) as the SoT.

**Rationale.** OMJ's mission is narrow and deep (the code↔Figma frontend loop). Iteration and parallelism are the platform's job — Claude Code already ships a native goal loop and native subagents, and duplicating them would be maintenance debt with no differentiation. What the platform does not provide is a **durable, evidence-gated completion contract** that survives session death — that is the one execution concern OMJ implements itself (`goal-loop` + the `goal-state.mjs` validator), and even that is a lane the user picks, never a default imposed on small work.

**Outcome.** Small work flows spec → approve → inline with zero orchestration overhead. Work with a crisp completion condition runs under `/goal`; separable work fans out to an agent team; work that must survive interruption or prove its completion runs under `/oh-my-joy:goal-loop`. In short, **"what to build" (the FE spec) is `/oh-my-joy:spec`'s job; "how to run it" is the lane's job**, and the spec is the bridge between them.

**Gate-coexistence rule — the planning gate and the goal gates do not block each other; they are orthogonal.** Only `/oh-my-joy:spec` uses Claude Code's native Plan mode (`ExitPlanMode`) as a *read* gate; `/goal` and `/oh-my-joy:goal-loop` own their *execution* gates (the evaluator's condition · the validator's evidence object). The gates are orthogonal, so there is no hard conflict — they meet only chronologically at the approval moment. The default flow is **straight to the selected lane after approval**; a `/oh-my-joy:ralplan` consensus pass is taken explicitly *only when things are genuinely ambiguous or consensus is needed*. Since `/oh-my-joy:spec` is read-only and cannot write source artifacts itself, file materialization happens *after* approval, in the execution lane. (Lane definitions, the auto-select rule, and `/goal clear` safety: [`docs/EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md).)

---

## ⑧ Minimal bundling (FF only) · single SoT — reference, don't vendor

**Problem.** The more quality skills a plugin bundles, the heavier it gets; and when the same knowledge is copied to several places, it becomes ambiguous where to apply an update (drift). The vercel-family skills (`vercel-react-best-practices`, `vercel-composition-patterns`, etc.) are useful but actively maintained upstream (vercel-labs/agent-skills).

**Decision.** OMJ bundles **only one self-authored skill, frontend-fundamentals** (OMJ's canonical SoT). The vercel family is not bundled but **referenced** — fetched on demand with: `npx skills add vercel-labs/agent-skills/vercel-react-best-practices` · `npx skills add vercel-labs/agent-skills/vercel-composition-patterns` · `npx skills update`. In short: own only the knowledge that is yours (FF); link to the knowledge others maintain better (vercel).

**Rationale.** This is the single-SoT principle. FF is OMJ's core quality philosophy, so it must be directly owned and version-pinned; but vendoring the vercel skills would drift from upstream and go stale quickly. Referencing means `update` always fetches the latest, and both bundle size and maintenance burden shrink.

**Outcome.** OMJ stays light, FF is managed in exactly one place with no drift. Users add vercel skills explicitly when needed, so what is OMJ-canonical versus externally referenced is always clear. (Same philosophy as managing vercel skills with lock/update in a project repo.)

**Boundary clarification — what "minimal bundling" forbids and what it does not.** The rationale of this principle is *preventing stale copies of externally maintained knowledge*. Therefore adding **self-authored artifacts OMJ directly owns and maintains** — FF `references/` (including figma-fidelity), the bundled agents (`figma-implementer` · `design-qa`), the hook script templates (`templates/hooks/`) — does not violate it (there is no upstream to drift from). The criterion is "is it a self-authored tool inside the FE loop, **or a self-authored rewrite of a general-purpose workflow that wraps the FE loop**"; knowledge that outsiders maintain better (vercel etc.) stays reference-only.

**The absorption rule for external methodologies (v0.6.0).** One target cannot be handled by referencing alone — when the subject is not a tool but a *methodology* (stage structure, gates, output contracts). Those are absorbed by **self-authored rewrite**, not by copying. Three conditions: ① credit the source and license in `NOTICE.md`; ② write new sentences, never copy the original's; ③ do not port the original's runtime (CLI, tmux, state-file conventions). A rewrite is self-authored, so there is no upstream-drift problem; when upstream updates, re-porting is a manual owner decision (no auto-sync — deliberate). `/oh-my-joy:deep-interview` (methodology sources credited in `NOTICE.md`) was the first case.

---

## ⑨ Graceful degradation — a missing dependency is a skip + guidance, not an error

**Problem.** OMJ leans on several optional dependencies — the official Figma Dev Mode MCP, playwright-cli, Context7. If a command throws and dies when any one is missing, users face a plugin where "nothing works until everything is installed". That raises the adoption barrier steeply.

**Decision.** Every dependency is **optional**; absence is handled as **skip + guidance instead of an error** (graceful degradation). Example: if the Figma MCP is not connected, announce "proceeding without URL contents, or accepting a manual spec" and continue. Without Context7, only the Next.js latest-docs lookup step is skipped. Missing playwright-cli likewise disables just that feature while the rest keeps working; a lane whose native support is absent degrades to inline (`docs/EXECUTION-HANDOFF.md`).

**Rationale.** The core value (spec authoring, token-sync structure) stands without the optional tools. Built as "better with, functional without", users get immediate value from whatever their environment allows and add tools incrementally. Making dependencies hard requirements is developer convenience that subtracts user value.

**Outcome.** OMJ works meaningfully in a minimal environment (read tools only), and capability grows as tools are added. The `/oh-my-joy:verify` preflight (`command -v`, `JOY_BASE_URL` defaulting to 3000, `curl` check) implements the same philosophy — kindly report what is missing and route through what is possible. Reinterpreting absence not as failure but as "the currently possible scope" is OMJ's posture throughout.

---

## ⑩ Acceptance: mechanism in the plugin, axes declared by the project — portability by design + an active verification op (`/oh-my-joy:fix`)

**Problem.** In measured logs the most frequent cause of rework was *systematic omission*, and those omissions almost always came from **project-specific conditions** (e.g. multi-locale, theme/brand modes, currency/format rules). Enforcing them at spec time reduces rework, but "what to enforce" differs per repo. OMJ targets company repos, personal projects, and **third-party open-source use**, so baking any axis (locales, modes, …) into the plugin body would make it false for other users and break portability.

**Decision.** Split acceptance into **mechanism (plugin) and axes·values (project)**, and **the plugin hard-codes no axis as built-in** (examples may be given, defaults may not). (a) `references/fe-acceptance.md` owns only the *mechanism*: "read the acceptance the project declared in `.omj/fe-context.md` and reflect it in specs and `/oh-my-joy:fix` diagnosis". Since `/oh-my-joy:spec` and `/oh-my-joy:ff-review` already invoke FF, this adds **zero new mechanisms**. (b) **What to check** (locales? modes? currency?) is 100% written by the project in its own `.omj/fe-context.md` — if absent, only universal FF criteria apply (graceful, ⑨). Universal axes (responsive, tokens, a11y) are already covered by spec.md Phase 2 / FF `references/` (⑧ single SoT).

**Rationale — two rejected alternatives.** (1) An "**always-on hook** injecting a checklist into every FE edit" breaks OMJ's zero-hook, side-effect-free design (①③), fires in every repo where installed (non-portable), and collides with the user's global FE-visual-verify PostToolUse hook (double-firing on .tsx/.jsx/.css). (2) "Baking axes like i18n/modes into FF" makes those axes noise for single-locale personal projects or other people's repos, since they are domain-specific. Both break *portability*. **"Structure in the plugin, axes and answers in the project"** is the decomposition that satisfies portability and correctness at once.

**Compatibility with the opt-in hooks (⑩ upheld, not reversed).** The token-guard hooks in `templates/hooks/` do not overturn the rejection above — the plugin ships no hooks.json, so **it never fires anywhere by itself** (zero-hook preserved; it merely *owns* the scripts), and activation happens only when `/oh-my-joy:setup` **copy-installs** them into a consuming project (true opt-in — the rejected always-on firing and forced double-firing cannot occur). The hook logic itself no-ops without an fe-context declaration, so no axis is enforced. Bundling the scripts is a literal softening of the "zero-hook" slogan, decided with owner approval in v0.3.0.

**Outcome.** The mechanism is identical wherever installed, and each repo decides its own axes via `.omj/fe-context.md` — a company repo declares locales and modes; a single-locale personal project declares nothing and that's fine. The plugin contains zero company/project proper nouns, so it is reusable as open source unchanged (an extension of ⑦·⑧).

**Extension into an active verification op — `/oh-my-joy:fix`.** *Perceptual* defects visible only in screenshots (color, z-index, alignment, rounding) cannot be caught by static acceptance. `/oh-my-joy:fix` exists for this — unlike `/oh-my-joy:spec` (primer) it is an **active op**, yet it does not break ③'s read-only-primer separation (the primer is still only `/oh-my-joy:spec`; `/oh-my-joy:fix` joins `/oh-my-joy:verify` · `/oh-my-joy:sync` (sync·push) in the active-op family). Capture **reuses** `/oh-my-joy:verify`'s `-s=omj` protocol (⑧ SoT — no second copy); the only genuinely new part is the edit *between* observation and re-verification — a thin composition of "look (`/oh-my-joy:verify`) → fix (`Edit`) → look again (`/oh-my-joy:verify`)". Plan mode blocks Edit and side-effectful Bash (playwright-cli etc.), so the plan gate (②) also stays intact.

---

## ⑪ Ask vs just do — don't spray AskUserQuestion

**Problem.** Misapplying "give the user choices" makes every command pop a modal, breeding prompt fatigue. Asking nothing makes the tool unilateral. A boundary is needed between where to ask and where to just act.

**Decision.** OMJ asks via `AskUserQuestion` only when **all four conditions** hold — (a) the direction/resolution is genuinely ambiguous, (b) no safe default can be inferred, (c) being wrong is expensive to reverse, and (d) the choice depends on **data discovered during execution**. Otherwise: print an advisory, take intent known in advance as a **flag** (e.g. `--commit`), or just execute if read-only/reversible. **One decision = at most one batched modal; per-item prompts are forbidden by default.**

**Rationale.** Intent expressible in advance (whether to commit) belongs in a flag; state that only emerges during execution (which drift, which direction) belongs in a prompt. That distinction is what separates "choice" from "fatigue".

**Outcome.** Under the base rule, the representative new prompt is `/oh-my-joy:sync` (sync) — direction conflicts satisfy all four conditions (⑥). On top of that there are **two bounded interaction classes**. First, `/oh-my-joy:spec` may use `AskUserQuestion` **at most once** after spec authoring to pick the execution lane. That choice is a pre-implementation handoff decision, and cost/coordination trade-offs among the lanes (in-session `/goal` iteration, agent-team parallelism, the durable evidence-gated loop) depend on user intent. However, **if the recommendation is inline, even this question is skipped** — the answer is self-evident, failing conditions (a) ambiguity and (b) non-inferability, and Plan approval itself becomes the consent point (`(auto)` recorded; rule canon `docs/EXECUTION-HANDOFF.md`). Only when a heavy lane is recommended is the single question asked; option 1 is the deterministic recommendation labeled `(recommended)`, and the chosen value is recorded in the spec. The overwrite confirmation in `/oh-my-joy:sync extract` also legitimately satisfies the four conditions (irreversible + non-inferable). `/oh-my-joy:fix` (the defect is already scoped by screenshot+complaint; committing is the `--commit` flag) and `/oh-my-joy:verify` (purely read-only, direction inherent) remain excluded by rule. `/oh-my-joy:setup`'s existing "install now?" conforms. Second, the **interview class** (v0.6.0): `/oh-my-joy:deep-interview` is canonically allowed one-question-per-round sequential prompting — each question depends on the previous answer, i.e. *data discovered during execution*, re-satisfying the four conditions every round, and the decision unit of "one decision = one batched modal" is the round. Three bounds keep it finite: a hard cap of 20 rounds, early exit allowed after round 3, and a suitability gate that refuses the interview outright for already-clear inputs. "Giving choice" is earned by **codifying the rule**, not by scattering prompts.

---

## What each principle looks like in the repo

- ① ③ — [`commands/spec.md`](../commands/spec.md) frontmatter: no `Write`, no `Edit`, no `Bash`.
- ⑥ — [`commands/sync.md`](../commands/sync.md): drift grouped into three classes, one batched question, reference-preserving guardrails on pull.
- ⑦ — [`EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md) is the single routing source of truth; commands link to it and never restate its thresholds (only a threshold-free fallback for when it cannot be read).
- ⑦ ⑧ — [`commands/goal-loop.md`](../commands/goal-loop.md) + [`scripts/goal-state.mjs`](../scripts/goal-state.mjs): the durable lane — state changes only through the pre-approved validator script; [`commands/ralplan.md`](../commands/ralplan.md) + [`agents/plan-critic.md`](../agents/plan-critic.md): consensus review whose read-only tool surface is fixed by invariant tests.
- ⑨ — every command's preflight section ends in "skip + guide", never an error path.
- ⑩ — [`templates/hooks/`](../templates/hooks) scripts no-op unless the consuming project declares the relevant key; the plugin ships no `hooks.json`.

---

## Sources

- uSpec (Uber): https://www.uber.com/ca/en/blog/automate-design-specs/ · https://docs.uspec.design/
- figma-console-mcp (Southleft): https://github.com/southleft/figma-console-mcp
- frontend-fundamentals: Toss FF four criteria (readability, predictability, cohesion, coupling) — OMJ's self-authored bundled canon
- Official Figma Dev Mode MCP / Context7 (`/vercel/next.js`) / playwright-cli — all optional dependencies

> Rule: this document is the canonical source. Write it in English; do not add AI signatures. Keep command names and install strings consistent with `commands/*.md`/README (SoT); for narrative content such as the mental model, the **README is canonical** and this document summarizes/links (verbatim duplication is not required).
