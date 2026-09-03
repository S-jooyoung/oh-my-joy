---
description: Entry point for concrete work — a Figma link ("implement this design/screen/component", "이 디자인/화면/컴포넌트 구현해줘"), a frontend task, or any general coding task. Reads the design or the code, authors the implementation spec as the Plan you approve, records the execution lane and the completion procedure, then stops
argument-hint: "[figma-url … | task description] [route]"
allowed-tools: Read, Grep, Glob, Skill, AskUserQuestion, mcp__plugin_figma_figma__get_design_context, mcp__plugin_figma_figma__get_screenshot, mcp__plugin_figma_figma__get_variable_defs, mcp__plugin_figma_figma__get_metadata, mcp__figma__get_design_context, mcp__figma__get_screenshot, mcp__figma__get_variable_defs, mcp__figma__get_metadata, mcp__plugin_context7-plugin_context7__*, mcp__context7__*
---

# /oh-my-joy:spec — Plan primer

Turn a concrete request into an implementation spec that is the native Plan the user approves, then stop. Implementation starts only after approval, on the execution lane the spec records.

This command is read-only on purpose. Its tools are `Read`/`Grep`/`Glob`, the read-only Figma tools, Context7, `Skill`, and one `AskUserQuestion` for the lane choice. A spec-writing step that could also write code would quietly bypass the approval gate, and in Plan mode (where most users run it) writes are blocked anyway. Keeping the two halves separate is what makes the spec trustworthy as a plan.

## Phase 0 — Classify the input

Process `$ARGUMENTS` in this order; each track is decided by the presence of its own signal, not by guessing.

1. If the arguments end with a token starting with `/` (for example `/settings/profile`), peel it off as the verification route. This command runs no verification; the route is recorded for `/oh-my-joy:verify`. Without a route token, infer the route where the target mounts during Phase 1 and record it as `Verification route (inferred): /xxx`, so a wrong inference stays visible. If nothing can be inferred, leave it blank.
2. A `figma.com` URL activates the figma track. A textual task alongside it runs the dev track in parallel; the two compose.
3. Text without a URL is either a frontend task or a general task. Treat it as frontend when it names UI components, hooks, pages, routes, styles, tokens, or frontend file paths; otherwise it is general (backend, scripts, tooling, this plugin itself). When unsure, look at the files it names.
4. Empty arguments (route only, or bare `/oh-my-joy:spec`) print the Usage section and stop. An empty spec helps nobody.
5. Text so vague that no verifiable goal or target can be read from it (no nameable outcome, no file, no acceptance you could check) gets one line — "narrow this first with `/oh-my-joy:deep-interview`" — and stops. This mirrors the interview's own gate, which sends already-concrete input back here.

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

Role boundary: the official figma plugin's `figma-design-to-code` skill asks to be loaded before any `get_design_context` call. This command does not load it while priming, because that skill steers implementation and priming is spec-writing; the implementation stage (`figma-implementer` or the inline executor) follows it. This is a decision, not an omission.

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

## Execution lane and completion procedure

Always end the spec with two sections. The routing rules and thresholds are canonical in `${CLAUDE_PLUGIN_ROOT}/docs/EXECUTION-HANDOFF.md` (repo-relative `docs/EXECUTION-HANDOFF.md`); if that file cannot be read, use the threshold-free fallback: small work → inline; iterate-until-condition → `/goal`; three or more independent units with disjoint files → agent team; a fuzzy requirement → `/oh-my-joy:deep-interview` first.

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
After approval: implement on the selected lane → /oh-my-joy:review → /oh-my-joy:verify <route or none> → (visual defects) /oh-my-joy:fix <route> until clean → report with evidence. /oh-my-joy:ship is yours to run.
```

The completion procedure is part of the approved plan, so the session follows it after approval without further prompting; `/oh-my-joy:ship` stays manual because pushing and opening a PR are visible to others. The canonical wording of the procedure and the per-lane copyable actions live in the routing document.

When the spec is written, stop. This command creates or modifies no files, runs no builds or tests, delegates nothing to subagents, and never clears an active `/goal`. The pipeline never auto-exits Plan mode; the user's approval is the only doorway to implementation.

## Usage

<example>
```
/oh-my-joy:spec https://figma.com/design/abc?node-id=1-2 /settings/profile   Figma design → implementation spec (Plan); large frames are walked section by section
/oh-my-joy:spec https://figma.com/design/... "add the empty state"           Figma link + text task, composed
/oh-my-joy:spec "search input form — React Hook Form + Zod, mobile first" /search   frontend text → uSpec-based spec
/oh-my-joy:spec "rate-limit middleware for the public API"                   general text → goal/constraints/acceptance/verification spec
```
</example>
