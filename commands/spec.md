---
description: Entry point for FE work and Figma design implementation (design to code) — paste a figma.com link or ask "implement this Figma design" ("이 디자인/화면/컴포넌트 구현해줘") and this command comes first. Collects the spec, authors an FF/vercel-applied implementation spec (Plan), and stops (implementation happens after approval)
argument-hint: "[figma-url … or task description] [route]"
allowed-tools: Read, Grep, Glob, Skill, AskUserQuestion, mcp__plugin_figma_figma__get_design_context, mcp__plugin_figma_figma__get_screenshot, mcp__plugin_figma_figma__get_variable_defs, mcp__plugin_figma_figma__get_metadata, mcp__figma__get_design_context, mcp__figma__get_screenshot, mcp__figma__get_variable_defs, mcp__figma__get_metadata, mcp__plugin_context7-plugin_context7__*, mcp__context7__*
---

# /oh-my-joy:spec — Frontend Plan primer

**Collects the specification** for frontend work, authors an **implementation spec (= native Plan)**, then **stops**. Actual code implementation is handled by the normal execution that follows the user approving that Plan (ExitPlanMode).

> ⚠️ **This command never writes code directly (read-only).** It does not Write/Edit files or run builds/verification. allowed-tools is limited to read tools (`Read`/`Grep`/`Glob`) + **figma read-only tools only** (`get_design_context`/`get_screenshot`/`get_variable_defs`/`get_metadata` — write tools like `use_figma` excluded) + Context7 + `Skill` (to load the frontend-fundamentals rubric) + at most one `AskUserQuestion` for execution-lane selection right before approval. A `/oh-my-joy:spec` call therefore has no source-code side effects, and the resulting spec is exactly the Plan the user approves — it does not conflict with an "almost always Plan mode" habit.

## Phase 0 — Mode dispatch (signal-presence based, in order)

Process `$ARGUMENTS` in the following order (no LLM guessing — each track is **decided independently by the mere presence of its signal**):

1. **First**, if the arguments end with a token starting with `/` (e.g. `/settings/profile`), **peel it off and record it as the verification route** only (this command does not run verification). If there is no route token, infer the route where the target component mounts during Phase 1 code exploration and record it in the spec with the label `Verification route (inferred): /xxx` (the label is mandatory so a wrong inference stays visible to the user; if inference is impossible, leave it blank — no forced guessing).
2. If the remaining arguments contain a `figma.com` URL → activate the **figma primer** track. If a non-URL **textual task item** is also present → **run dev-primer collection in parallel** (the two tracks are not exclusive but **composable** — each decided independently by its signal). If there are more than 5 Figma nodes, propose splitting the work to prevent spec bloat and context waste.
3. If the remaining arguments are text only (no URL) → **dev primer**.
4. If the remaining arguments are **empty** (route only, or bare `/oh-my-joy:spec`) → print the "Usage" section below and stop. **Never author an empty spec.**

- **Pasted-image interpretation**: if a screenshot was pasted into the conversation, interpret in one line whether it is *evidence of the current state* or *the expected design*, and record that in the spec Context (the canonical interpretation rules live in `fix.md` step 1).
- Boilerplate that Figma "Copy as prompt" attaches ("Implement this 1 design from Figma" and the like) is not a task item — ignore it.

Verification (visual comparison) is owned by the separate command `/oh-my-joy:verify`, not this one. Words like `verify`/`review` inside a task description are part of the dev task description, not mode keywords.

## Phase 1 — Spec collection (read-only)

**figma primer**: read the design via the official Figma (Dev Mode) MCP (read-only).
- `mcp__plugin_figma_figma__get_design_context` — structure/layout spec for code
- `mcp__plugin_figma_figma__get_screenshot` — reference image (the later `/oh-my-joy:verify` comparison baseline). Images in session context vanish when the session ends and asset URLs expire after ~7 days, so **record the node ID, asset URL, and captured-at timestamp in the spec** — after approval, `/oh-my-joy:verify` persists the PNG to `.omj/baselines/` from that URL (downloading belongs to the active ops verify/fix; the primer only records).
- `mcp__plugin_figma_figma__get_variable_defs` — design tokens/variables
- `mcp__plugin_figma_figma__get_metadata` — node metadata (optional)
- If the Figma MCP is unavailable (not installed, desktop not connected), **do not treat it as an error** — announce "Figma not connected — proceed without the URL contents or take a manual spec" (graceful). Viewer-permission files are denied variable/node access — advise "Duplicate the file and retry with the copy's URL".
- **Role boundary with the official figma skill**: the official figma plugin's `figma-design-to-code` skill mandates loading itself before any `get_design_context` call, but `/oh-my-joy:spec` priming **knowingly does not follow it — a deliberate decision**. That skill presumes implementation, whereas priming is spec-writing reads; loading implementation-steering instructions would erode the read-only plan-gate identity (PRINCIPLES ①③). Upstream instructions are followed by the **post-approval implementation stage** (figma-implementer / inline executor). Even in sessions where both skills are loaded, the division of labor stays the same: priming=OMJ, implementation=upstream compliance (no content duplication). This section does **not arbitrate skill-triggering competition** — that layer belongs to description triggers.

**dev primer**: read the target code.
- Collect task-relevant components/hooks/styles/types with `Glob`·`Grep`·`Read` to understand the current structure and reusable patterns.

**Common (optional)**: if the change touches Next.js version-sensitive topics, follow the **routing rules of the `frontend-fundamentals` skill** and query the latest `/vercel/next.js` docs via Context7 (`resolve-library-id` → `query-docs`). The SoT for the version-sensitive topic list and vercel/Context7 routing is the FF skill; do not restate it here — delegate. Skip this step if Context7 is absent (graceful). If the repo root has `.omj/fe-context.md` declaring `designDocPath`·`contextDocs`, also `Read` those documents and reflect brand/composition/project rules in the spec (use the `decisions:` list as a recurrence-prevention check). Conversely, if there is **no setup trace at all** (no `.omj/` in the repo + no `~/.claude/.omj-setup.json` marker), append one line at the end of the spec: "If this is your first run, running `/oh-my-joy:setup` once is recommended (fe-context, hooks, dependency check)" — suggest only, never execute.

## Phase 2 — Author the implementation spec, then STOP

Write the **implementation spec** from the collected material. Structure the spec with the **uSpec section taxonomy** below and evaluate every section against the **frontend-fundamentals 4 criteria (readability, predictability, cohesion, coupling) + accessibility**. Load the rubric by **invoking the frontend-fundamentals skill** via `Skill` and using its `references/`. For the figma primer, apply the **Figma fidelity rules** (`references/figma-fidelity.md` — keep original text, no invented variants, no fixed px, no hardcoded tokens) across every spec section:

1. **Anatomy** — decompose the UI to build (which components/subcomponents it consists of).
2. **Structure** — layout, spacing, dimensions, responsive breakpoints (mobile first; especially sensitive for services where mobile sharing matters). Component width uses `w-full` + parent padding control instead of fixed px (`figma-fidelity.md`).
3. **Color / Tokens** — map colors/typography/radius/shadow to **semantic tokens** (no raw hex, no direct Primitive use). Find the token system via the **detection order in `references/fe-acceptance.md`** (① fe-context `tokensPath` → ② conventional tokens.json paths → ③ Tailwind config/`@utility` CSS → ④ CSS variables) — **the absence of tokens.json is no license for raw values**: map to the semantic classes/variables of whatever system was detected.
4. **Props / Variants** — component API (props interface, variant axes). Predictability: name = behavior. Coupling: avoid props drilling. **Never invent variants that do not exist in Figma** (`figma-fidelity.md`).
5. **A11y** — alt/labels/semantic tags/keyboard/touch targets (VoiceOver·ARIA).
6. **Motion** — if there is animation, timeline/easing in `motion` (Motion One) terms.

**Implementation acceptance (project-declaration based)**: if the repo root has **`.omj/fe-context.md`**, include the **project-specific acceptance axes** declared there in the spec's acceptance criteria. If absent, apply only the universal FF criteria (graceful). **OMJ does not force any particular axis (i18n, modes, etc.)** — the project decides what to check (general-purpose, open-source friendly). Mechanism details: `frontend-fundamentals` `references/fe-acceptance.md`. Universal axes such as responsiveness/tokens/a11y are already covered by the Structure/Color·Tokens/A11y sections above.

The spec must state the **target file paths**, **existing functions/components to reuse**, **FF/vercel principles to apply**, the **verification route** (from the argument or Phase 0 inference — label `(inferred)` when inferred), and for the figma primer the **baseline provenance** (node ID, asset URL, captured-at).

**No overengineering**: abstract only when things are certain to change together. Do not needlessly abstract simple logic or build deep layers for futures that will not happen (`frontend-fundamentals` "overengineering warning").

**Execution lane selection (read-only handoff)**: always append an `## Execution lane selection` section at the end of the spec. The routing-rule SoT is `${CLAUDE_PLUGIN_ROOT}/docs/EXECUTION-HANDOFF.md` (repo-relative `docs/EXECUTION-HANDOFF.md`); only when that file cannot be read, use the minimal fallback (small → inline; iterate-until-condition → `/goal`; parallel lanes → agent team; durable/evidence-gated → `/oh-my-joy:goal-loop`; more consensus needed → `/oh-my-joy:ralplan` before approval). Do not duplicate score tables/thresholds in command bodies.

The lane-selection question is **conditional** (the SoT's auto-select rule): if the recommended lane is **inline**, **do not ask** — just record `Selected lane: inline (auto)` in the spec. Plan approval is lane consent; if the user disagrees they can edit the plan on the approval screen. When any heavier lane (`/goal` · agent team · `/oh-my-joy:goal-loop`) is recommended, ask via `AskUserQuestion` **exactly once** after the spec is complete. Option 1 is always the deterministic recommendation, labeled `(recommended)`. When requirements/boundaries/architecture consensus is still lacking, recommend a `/oh-my-joy:ralplan` pass before approval instead of a heavier execution lane.

The final spec records the selection in this format:

```md
## Execution lane selection
1. Lane: /oh-my-joy:goal-loop (recommended) — multi-turn work; completion must be evidence-gated.
2. Lane: /goal — iterate in this session until the stated condition holds.
3. Lane: inline — implement directly in this session.

Selected lane: <...>          # on auto-select: inline (auto)

After approval, run exactly this one line:
<the selected lane's copyable action — omitted for inline>
```

After approval, the lane section itself is the handoff: for a heavy lane it already ends with the one copyable action (shapes per lane: `docs/EXECUTION-HANDOFF.md`), and **specs recorded `inline (auto)` have nothing to launch** — on approval the current session proceeds with inline implementation immediately. `/oh-my-joy:spec` never implements, builds, tests, delegates to subagents, or performs hidden `/goal clear`.

When authoring is done, **stop here.** Never do any of the following:
- Create or modify code files (no Write/Edit — not in allowed-tools)
- Run builds/tests/verification
- Delegate implementation to subagents or executors
- Silently clear an active `/goal` or goal-loop state

> **The full pipeline never auto-exits Plan mode.** Once the user reviews this spec and approves it themselves (ExitPlanMode), implementation begins from there.

## After approval (outside this command's scope, for reference)

Once the user approves the spec, execution follows the lane recorded in it. If the selected lane is already recorded (manually chosen or `(auto)`), do not ask again — use it as is: inline proceeds in the current session, and a heavy lane starts from the copyable action the lane section printed. After implementation, verify the code diff with `/oh-my-joy:ff-review` (FF·a11y·vercel·nextjs) and the visuals with `/oh-my-joy:verify <route>`. (Lane definitions and gate orthogonality: `${CLAUDE_PLUGIN_ROOT}/docs/EXECUTION-HANDOFF.md` (repo-relative `docs/EXECUTION-HANDOFF.md`).)

## Usage (bare `/oh-my-joy:spec`)

```
/oh-my-joy:spec <figma-url> [route]        Figma design → implementation spec (Plan). e.g. /oh-my-joy:spec https://figma.com/design/... /settings/profile
/oh-my-joy:spec <figma-url> <figma-url> "<task description>"   mixed multi-node + text tasks supported (composite collection; proposes a split above 5 nodes)
/oh-my-joy:spec "<task description>" [route]       code task → implementation spec (Plan). e.g. /oh-my-joy:spec "search input form component" /settings/profile
/oh-my-joy:ff-review [--base <ref>]      post-implementation code diff review (FF·a11y·vercel·nextjs, run outside Plan mode)
/oh-my-joy:verify <route>             post-implementation visual verification (run outside Plan mode)
/oh-my-joy:fix <route> ["description"]        screenshot+route defect fix loop (run outside Plan mode)
/oh-my-joy:sync [sync|check|push|extract <figma-url>]   design tokens code↔Figma (extract: Figma variables → CSS custom properties)
/oh-my-joy:setup                      dependency check/install guide + fe-context/hook scaffolding
```
