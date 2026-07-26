# Design principles — English summary

> **Summary only.** The canonical rationale — problem → decision → reasoning → outcome, with the alternatives that were rejected and why — is in [`PRINCIPLES.md`](PRINCIPLES.md) (Korean). This page exists so the design decisions are legible without Korean; when the two disagree, the Korean document wins.

The through-line of this plugin is a single idea: **treat the tool's constraints as the design axis instead of working around them.** Claude Code's Plan mode blocks writes, so the entry-point command was built to have no write path at all — and that turned a limitation into the review gate the workflow needed.

| # | Principle | Problem it solves | Decision | Rejected alternative |
| --- | --- | --- | --- | --- |
| ① | **Plan-native primer** | Plan mode blocks `Write`/`Edit`, yet that is the mode users live in — a one-shot implement command half-works where it is invoked most | `/omj` collects the design spec, authors an implementation spec, and stops. That spec *is* the native Plan | A full-auto "Figma → code in one command": demos well, but forces implementation without review |
| ② | **Plan-first over convenience** | Convenience and review-before-write cannot both be satisfied in one turn | Split into two halves — primer drafts, you approve, execution implements. Convenience survives as continuity *after* the gate | Immediate implementation: saves little, and bad frontend abstractions are expensive to undo |
| ③ | **Read-only command + least privilege** | A command with write access both violates least privilege and opens a path around the plan gate | Remove `Write`/`Edit`/`Bash` from `/omj` entirely. Removing the permission *is* the enforcement | Keeping the tools and instructing the model not to use them — prose is not an enforcement layer |
| ④ | **Two-track Figma strategy** | "Reading Figma" is two different jobs: screen → code, and design-system spec/token extraction | Official Dev Mode MCP for screens; a console-based MCP + uSpec for design-system extraction | One tool for both — neither job gets done well |
| ⑤ | **uSpec skeleton × quality rubric** | Free-form specs omit a different thing every time; a rigid skeleton with no rubric is empty formalism | Borrow uSpec's section taxonomy for structure, score each section with the FF four criteria + a11y | Prose specs, or a rubric with no fixed shape |
| ⑥ | **Interactive token sync** | Drift between code tokens and Figma variables is inevitable; picking the winner automatically breaks design systems silently | Code is the *default* source of truth, but on conflict the user picks the direction per drift class. Option 1 always follows code authority, so pressing enter stays safe | Automatic bidirectional merge — that is where the permanent conflict-resolution debt comes from |
| ⑦ | **Independent of, and composable with, other orchestrators** | Depending on a general orchestrator makes this plugin break without it and blurs responsibility | Fully standalone, `/omj*` namespace owned. The approved spec is the handoff artifact that other execution tools consume | Reimplementing durable goals, parallel workers, and QA loops that other tools already do well |
| ⑧ | **Bundle only what you own** | Duplicated knowledge drifts from its upstream and doubles maintenance | Bundle the self-authored quality skill; *reference* externally maintained skills instead of vendoring them | Vendoring third-party skills — stale within one upstream release |
| ⑨ | **Graceful degradation** | Optional dependencies (Figma MCP, playwright, Context7) turn into hard blockers if their absence is an error | Every dependency is optional: absence means "skip + explain", never a crash | Hard requirements — turns a plugin into a setup project and kills day-one value |
| ⑩ | **Mechanism in the plugin, axes in the project** | The most common cause of rework is a *project-specific* omission (locales, theme modes, currency), and no plugin can know which | The plugin owns only the mechanism; each project declares what to check in `.omj/fe-context.md`. No axis is built in | (a) An always-on hook firing in every repo; (b) baking specific axes into the shared rubric. Both break portability |
| ⑪ | **Ask rarely, and only by rule** | Scattering prompts causes prompt fatigue; asking nothing makes the tool decide unilaterally | Prompt only when all four hold: genuinely ambiguous, no safe default, expensive to reverse, *and* dependent on data discovered at runtime. Otherwise use a flag, print advice, or just do it | Per-item confirmation prompts, or silent unilateral decisions |

## What each principle looks like in the repo

- ① ③ — [`commands/omj.md`](../commands/omj.md) frontmatter: no `Write`, no `Edit`, no `Bash`.
- ⑥ — [`commands/omj-sync.md`](../commands/omj-sync.md): drift grouped into three classes, one batched question, reference-preserving guardrails on pull.
- ⑦ — [`EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md) is the single routing source of truth; commands link to it and never restate thresholds.
- ⑨ — every command's preflight section ends in "skip + guide", never an error path.
- ⑩ — [`templates/hooks/`](../templates/hooks) scripts no-op unless the consuming project declares the relevant key; the plugin ships no `hooks.json`.
