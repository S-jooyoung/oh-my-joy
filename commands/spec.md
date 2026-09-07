---
description: Entry point for concrete work — a Figma link ("implement this design/screen/component", "이 디자인/화면/컴포넌트 구현해줘"), a frontend task, any coding task, or an interview's requirements. Reads the design or the code, builds the spec, critiques it (an independent critic on non-trivial plans), records the lane and the completion procedure, then stops
argument-hint: "[figma-url … | task description] [route]"
allowed-tools: Read, Grep, Glob, Skill, Agent, AskUserQuestion, mcp__plugin_figma_figma__get_design_context, mcp__plugin_figma_figma__get_screenshot, mcp__plugin_figma_figma__get_variable_defs, mcp__plugin_figma_figma__get_metadata, mcp__figma__get_design_context, mcp__figma__get_screenshot, mcp__figma__get_variable_defs, mcp__figma__get_metadata, mcp__plugin_context7-plugin_context7__*, mcp__context7__*
---

# /oh-my-joy:spec — Plan primer

Turn a concrete request into an implementation spec that is the native Plan the user approves, then stop. Implementation starts only after approval, on the execution lane the spec records.

This command is read-only on purpose. Its tools are `Read`/`Grep`/`Glob`, the read-only Figma tools, Context7, `Skill`, `Agent` for the read-only `critic` reviewer only, and `AskUserQuestion` for the lane choice and, after two failed critique revisions, for the items still open. A spec-writing step that could also write code would quietly bypass the approval gate, and in Plan mode (where most users run it) writes are blocked anyway. Keeping the two halves separate is what makes the spec trustworthy as a plan.

## Phase 0 — Classify the input

Process `$ARGUMENTS` in this order; each track is decided by the presence of its own signal, not by guessing.

1. If the arguments end with a token starting with `/` (for example `/settings/profile`), peel it off as the verification route. This command runs no verification; the route is recorded for `/oh-my-joy:verify`. Without a route token, infer the route where the target mounts during Phase 1 and record it as `Verification route (inferred): /xxx`, so a wrong inference stays visible. If nothing can be inferred, leave it blank.
2. A `figma.com` URL activates the figma track. A textual task alongside it runs the dev track in parallel; the two compose.
3. Text without a URL is either a frontend task or a general task. Treat it as frontend when it names UI components, hooks, pages, routes, styles, tokens, or frontend file paths; otherwise it is general (backend, scripts, tooling, this plugin itself). When unsure, look at the files it names.
4. Empty arguments (route only, or bare `/oh-my-joy:spec`) print the Usage section and stop. An empty spec helps nobody.
5. A requirements spec from `/oh-my-joy:deep-interview` in the session context (or pasted) is the fourth kind of input: its goal, constraints, acceptance criteria, non-goals, and `Research first` rows are canonical, the frontend-or-general choice follows its content, Phase 1 gathers only what the interview could not (target files, reuse candidates, verification commands, the design), and nothing the interview already answered is asked again. Empty arguments with such a spec in context proceed with it instead of printing Usage.
6. Text so vague that no verifiable goal or target can be read from it (no nameable outcome, no file, no acceptance you could check) gets one line — "narrow this first with `/oh-my-joy:deep-interview`" — and stops. This mirrors the interview's own gate, which sends already-concrete input back here.

Two small rules for pasted material: a pasted screenshot is interpreted in one line as either evidence of the current state or the expected design, and that reading goes into the spec's Context (the interpretation rules are canonical in `fix.md`). Boilerplate that Figma's "Copy as prompt" attaches ("Implement this 1 design from Figma") is not a task item.

## Phase 1 — Gather (read-only)

### Figma track

Read the design as data through the official Dev Mode MCP:

- `mcp__plugin_figma_figma__get_design_context` — layout and structure for code.
- `mcp__plugin_figma_figma__get_screenshot` — the reference image that `/oh-my-joy:verify` compares against later. Images in session context vanish with the session and asset URLs expire after about 7 days, so record the node ID, the asset URL, and the captured-at time in the spec; `/oh-my-joy:verify` persists the PNG to `.omj/baselines/` after approval.
- `mcp__plugin_figma_figma__get_variable_defs` — design tokens.
- `mcp__plugin_figma_figma__get_metadata` — node structure.

Section walk. One `get_design_context` call over a large frame returns a flattened, truncated picture, and the detail is exactly what a spec needs. So start with `get_metadata` on the root node and count its top-level child frames or sections:

- Fewer than 3 children: read the frame in one pass as before.
- 3 to 8 children: section mode. Call `get_design_context` per section node ID in sequence and author a per-section spec. Take one root screenshot, and section screenshots only where a section's visual detail matters for verification. Assign each section to target files that no other section touches — the agent-team lane relies on that ownership being disjoint.
- More than 8 children: propose splitting the frame into smaller links and stop; a spec that large will not survive review.

If the Figma MCP is unavailable (plugin missing, desktop not connected), say "Figma not connected — proceeding without the link contents; paste the spec manually if you have one" and continue. Viewer-permission files deny node and variable access; advise duplicating the file and retrying with the copy's URL.

Role boundary: the official figma plugin's `figma-design-to-code` skill asks to be loaded before any `get_design_context` call. This command does not load it while priming, because that skill steers implementation and priming is spec-writing; the implementation stage (the `implementer` agent, or the session inline) follows it. This is a decision, not an omission.

### Dev track (frontend text)

Collect the components, hooks, styles, and types the task touches with `Glob`, `Grep`, and `Read`, so the spec names real files and reuse candidates rather than inventing them.

### General track (non-frontend text)

Read the code the task touches the same way, and additionally find how the project proves things work: `verifyCommands:` in `.omj/fe-context.md`, then `package.json` scripts named `typecheck`, `lint`, and `test`. Those commands become the spec's verification commands, which `/oh-my-joy:verify` and `/oh-my-joy:ship` run later.

### Common

- For Next.js version-sensitive topics, follow the routing rules of the `frontend-fundamentals` skill and query the current `/vercel/next.js` docs via Context7 (`resolve-library-id`, then `query-docs`). Without Context7, skip this step.
- If `.omj/fe-context.md` declares `designDocPath`, `contextDocs`, or `decisions`, `Read` them and reflect the project's rules; the `decisions:` list is a recurrence-prevention checklist.
- If there is no setup trace (no `.omj/` in the repo and no `~/.claude/.omj-setup.json`), append one line at the end of the spec suggesting `/oh-my-joy:setup` — suggest only.

## Phase 2 — Author the spec, then stop

Load the rubric by invoking the `frontend-fundamentals` skill via `Skill` and use its `references/`.

Frontend specs use the six uSpec sections and evaluate every section against the four frontend-fundamentals criteria (readability, predictability, cohesion, coupling) plus accessibility. On the figma track, apply the fidelity rules from `references/figma-fidelity.md` throughout: keep original text, invent no variants, no fixed px widths, no hardcoded tokens.

1. Anatomy — the components and subcomponents to build.
2. Structure — layout, spacing, dimensions, responsive breakpoints (mobile first). Width uses `w-full` plus parent padding instead of fixed px.
3. Color / Tokens — map colors, typography, radius, and shadow to semantic tokens; find the token system by the detection order in `references/fe-acceptance.md`. The absence of `tokens.json` never licenses raw values.
4. Props / Variants — the component API. Names match behavior; avoid props drilling; only variants that exist in Figma.
5. A11y — alt text, labels, semantic tags, keyboard, touch targets.
6. Motion — timelines and easing in `motion` terms, when there is animation.

General specs use a plainer skeleton: Goal (one sentence), Constraints, Target files and reuse candidates, Acceptance criteria (each checkable), Verification commands, Non-goals.

Every spec, either kind, also states the target file paths, the functions or components to reuse, the verification route (frontend) or verification commands (general), and on the figma track the baseline provenance (node ID, asset URL, captured-at). If `.omj/fe-context.md` declares acceptance axes, include them in the acceptance criteria; without the file, only the universal criteria apply.

Section mode adds a Sections table and, when the agent-team lane is recommended, a Dispatch table in this shape:

| Section | Figma node | Teammate | Owns files | Verify command |
| --- | --- | --- | --- | --- |
| Header | 12:34 | header | src/components/checkout/Header.tsx | npx tsc --noEmit |

Rows own disjoint files, because teammates editing the same file overwrite each other.

Abstract only when things will certainly change together. Simple logic stays simple; layers built for futures that will not happen are the overengineering the rubric warns about.

## Phase 3 — Critique the draft before presenting it

A spec that reads well can still send the executor guessing, and Plan approval is a consent gate, not a feasibility check: whatever the draft assumes, approval inherits. So the primer challenges its own draft once, against the real code, before the user sees it.

1. Decision record. When the spec introduces a new file, abstraction, or dependency, or changes a public contract, write the decision drivers (at most three), the viable options (at least two, one line of trade-off each), and why the chosen one won; when only one option survives, one line on why the others are invalid. Work of one or two files with no new abstraction records `single viable option: <reason>` — the record stays proportional to the risk.
2. Simulated implementation. Pick two or three representative tasks from the spec (one per section, or one per cluster of acceptance criteria) and walk each against the actual files with `Read` and `Grep`: the target file or its parent exists, the reuse candidate has the API the spec relies on, the acceptance criterion has a way to be checked. Each simulation ends in `proceeds without guessing` or names the gap.
3. Verdict. `ready` when every simulation proceeds without guessing, every acceptance criterion is checkable, and in section mode the owned files are disjoint. Otherwise fix the gaps in the spec and run the gate again, at most two revisions. Items still open after the second revision go to the user in one `AskUserQuestion` — the only critique question, asked before approval so that execution can stay question-free — and the answers are folded into the spec.
4. Scope check. The critique narrows or corrects the spec; it does not widen it. Anything discovered outside the request goes to Non-goals or to a one-line follow-ups note.

That is the self-critique, and it runs for every spec because it is cheap. It is also written by the context that wrote the draft, and an author tends to approve its own assumptions. So a plan that is not small gets a second reading from contexts that did not write it:

5. Independent critique. When the spec names three or more target files, introduces an abstraction, dependency, or public-contract change, runs in section mode, or carries a risk the interview flagged, spawn two `critic` agents in parallel with `Agent` — one with the architect lens, one with the critic lens — passing the draft spec and the target-file list. Each returns a verdict (`CLEAR`, `REVISE`, `BLOCK`) and findings. Fold `BLOCK` and `REVISE` findings into the spec; when the two lenses conflict, record one disposition in the decision record (accept one, synthesize, or ask). Then send the delta back to the same lenses, which re-review only what changed; at most two passes. A `BLOCK` that survives the second pass goes to the user as the one critique question, together with the best version of the spec. Where `Agent` is unavailable, the self-critique stands alone and the closing line says so.

Append the result as a `## Critique` section right before the lane section: the decision record, a table `Simulated task | Files | Result`, the independent findings that changed the spec (each marked with its lens), and a closing line — `Critique: ready (self)` for a small plan, `Critique: ready (independent: 2 lenses, N passes)` after the second reading, with `after N revisions` when the self-critique looped.

## Execution lane and completion procedure

Always end the spec with two sections after the critique. The routing rules and thresholds are canonical in `${CLAUDE_PLUGIN_ROOT}/docs/EXECUTION-HANDOFF.md` (repo-relative `docs/EXECUTION-HANDOFF.md`); if that file cannot be read, use the threshold-free fallback: small work → inline; iterate-until-condition → `/goal`; three or more independent units with disjoint files → agent team; a fuzzy requirement → `/oh-my-joy:deep-interview` first.

The lane question is conditional. When the recommendation is inline, ask nothing and record `Selected lane: inline (auto)` — Plan approval is the consent, and the user can edit the plan on the approval screen. When `/goal` or agent team is recommended, ask via `AskUserQuestion` exactly once after the spec is complete, with option 1 as the recommendation labeled `(recommended)`.

```md
## Execution lane selection
1. Lane: agent team (recommended) — 4 independent sections with disjoint files.
2. Lane: /goal — iterate in this session until the stated condition holds.
3. Lane: inline — implement directly in this session.

Selected lane: agent team          # on auto-select: inline (auto)

After approval, run exactly this one line:
<the selected lane's copyable action — omitted for inline>

## Completion procedure
After approval: implement on the selected lane → /oh-my-joy:review → /oh-my-joy:verify <route or none> → (visual defects) /oh-my-joy:fix <route> until clean → report with evidence. Execution asks no questions; blockers are classified and reported (rules in the routing document). /oh-my-joy:ship is yours to run.
```

The completion procedure is part of the approved plan, so the session follows it after approval without further prompting and without asking questions — where the plan is silent it picks the option most consistent with the spec and records the assumption in the report; `/oh-my-joy:ship` stays manual because pushing and opening a PR are visible to others. The canonical wording of the procedure and the per-lane copyable actions live in the routing document.

When the spec is written, stop. This command creates or modifies no files, runs no builds or tests, delegates nothing to subagents, and never clears an active `/goal`. The pipeline never auto-exits Plan mode; the user's approval is the only doorway to implementation.

## Usage

<example>
```
/oh-my-joy:spec https://figma.com/design/abc?node-id=1-2 /settings/profile   Figma design → implementation spec (Plan); large frames are walked section by section
/oh-my-joy:spec https://figma.com/design/... "add the empty state"           Figma link + text task, composed
/oh-my-joy:spec "search input form — React Hook Form + Zod, mobile first" /search   frontend text → uSpec-based spec
/oh-my-joy:spec "rate-limit middleware for the public API"                   general text → goal/constraints/acceptance/verification spec + critique
/oh-my-joy:spec                                                              after /oh-my-joy:deep-interview: the interview's requirements in context become the spec
```
</example>
