---
description: Sync design tokens code↔Figma — groups drift by class and asks the direction to resolve each (code is the default SoT). extract bootstraps Figma variables into CSS custom properties
argument-hint: "[sync|check|push|extract <figma-url>] [--tokens <path>]"
allowed-tools: Read, Edit, Write, Grep, Glob, Skill, AskUserQuestion, mcp__plugin_figma_figma__get_variable_defs, mcp__plugin_figma_figma__use_figma, mcp__figma__get_variable_defs, mcp__figma__use_figma
---

# /oh-my-joy:sync — Design token sync (code ↔ Figma, interactive)

Compute the drift between a file-based token store (`tokens.json` in W3C DTCG, or CSS custom properties in `*.css`) and Figma Variables, and resolve it by asking the user the direction for each conflict class. `extract` is the bootstrap that turns Figma variables into code for the first time.

Code is the default source of truth, but the direction of each conflict is the user's call. Automatic merges are where design systems drift silently, so when drift exists the command groups it by class and asks once (code→Figma / Figma→code / skip) via `AskUserQuestion`. The first option of every question follows code authority — code→Figma for value mismatches and code-only tokens, the conservative skip for Figma-only tokens — so pressing enter yields the same safe result as a one-way code-wins sync. `push` is the fast path that explicitly chooses code-wins without questions; `check` is a read-only diagnostic.

Target file: the active tab of the Figma desktop app. `use_figma` and `get_variable_defs` operate on the active-tab file, so open the design-system file as the active tab before running; the URL in `extract <figma-url>` is a marker meaning "open this file", not an address. `sync`, `push`, and `extract` are active ops (desktop app running, outside Plan mode). Figma variable and node access requires edit permission — on a viewer-permission file, Duplicate it and open the copy.

## Modes

- `sync` (default, bare `/oh-my-joy:sync`) — compute drift and ask the direction per class.
- `check` — read-only drift report, no edits, no questions.
- `push` — bulk create/update the token store into the active tab's Variables without questions (explicit code-wins).
- `extract <figma-url>` — Figma → code bootstrap: all variables of the active tab become CSS custom properties in new token files.
- `--tokens <path>` — the token store. When omitted, follow the token-system detection order in `references/fe-acceptance.md`; `sync`/`push`/`extract` target file-based stores only (`.json` as DTCG, `.css` as custom properties). Tailwind config themes may be detected but are not sync targets; bootstrap those with `extract`.

Permissions are per command, so all four modes share the same tools, and the body keeps them apart: `check` calls no `Edit`, `Write`, or `use_figma`; `sync` and `push` use `Edit` plus `use_figma`; `Write` is for `extract` only, because existing stores are edited surgically to preserve order, format, and comments.

## The two store shapes

A. `tokens.json` (W3C DTCG). Typical hierarchy: primitives such as `color/{scale}/{step}` (`color/gray/100`); semantics such as `color/{brand,fg,surface,line,feedback}/*` that alias primitives (`{color.red.700}`); theme, typography, radius, shadow, and font-family slots. Design work uses semantics.

B. CSS custom properties (`*.css`) — `:root { --color-gray-100: #f1f3f5; --color-fg-primary: var(--color-gray-900); }`. Declarations starting with `--` are tokens; `var(--x)` values are aliases, isomorphic to DTCG `{x}` references. Names map by `/`→`-`: `color/gray/100` ↔ `--color-gray-100`.

## extract procedure (Figma → CSS bootstrap)

1. Confirm the target file is the active tab and read every variable with `get_variable_defs`. If access is denied, advise edit permission or duplicating the file and stop.
2. Convert names with `/`→`-` (`color/brand/primary` → `--color-brand-primary`). Preserve the primitive→semantic structure: an alias in Figma becomes a `var(--primitive-*)` reference in CSS, never a duplicated raw value.
3. Split files by collection or category (`src/tokens/colors.css`, `src/tokens/spacing.css`); prefer paths from `--tokens` or fe-context, otherwise propose `src/tokens/`.
4. If a target file already exists, ask overwrite / merge / abort via `AskUserQuestion` — the action is irreversible and not inferable. `Write` new files only.
5. Create or update the mapping table (Figma name ↔ CSS name ↔ value or reference) in `docs/design-tokens.md`, with `Edit` when the file exists.
6. Summarize: variables extracted per collection, aliases preserved, files created. Point to `check`/`sync` for routine drift management.

## sync procedure (interactive default)

1. Compute drift read-only: parse the store with `Read` (per shape A or B), read the active tab's variables with `get_variable_defs`, and compare. Three classes: value mismatch (exists on both, differs), code-only, Figma-only. If Figma is unconnected or unauthorized, advise "start the desktop app and open the target file as the active tab (duplicate viewer files)" and stop.
2. With no drift, finish with "in sync — no drift to resolve" and ask nothing.
3. With drift, ask a single `AskUserQuestion` with one question per non-empty class (at most three questions, one modal, never per token). Option 1 of each is the code-authority default:
   - Q1 value mismatches (N): code→Figma (code wins) [default] · Figma→code · skip · pick per item
   - Q2 code-only (M): create in Figma (code→Figma) [default] · remove from code · skip
   - Q3 Figma-only (K): skip [default, conservative] · add to code (Figma→code) · remove from Figma
   Only Q3 defaults to skip because leaving Figma-only tokens alone keeps code as the untouched source of truth; nothing is auto-created or auto-deleted.
4. Apply the chosen resolution per class:
   - code→Figma / create in Figma: first invoke the `figma-use` skill via `Skill`, then with `use_figma` create or update only the affected variables, never a full collection rebuild. Semantics reference primitives as aliases. If a referenced primitive does not exist in Figma yet, create it first so no alias dangles.
   - Figma→code / add to code: `Edit` only the affected node or declaration in the store, preserving order, format, and comments, under the reference-preservation rules below.
   - remove from Figma / remove from code: `use_figma` deletion / `Edit` removal respectively.
   - skip: no-op, listed as unresolved drift in the summary.
5. "Pick per item" is opt-in only: drill into that class with follow-up `AskUserQuestion`s of at most four items each. Above roughly 12 items, warn "too many — handling in bulk" and fall back to bulk; per-item is never the default path.
6. Summarize resolved counts per direction and the unresolved drift count.

### Reference-preservation rules (Figma→code pulls, DTCG and CSS alike)

Flattening a semantic token into raw hex when pulling Figma values into code breaks the token system silently, so:

1. If the Figma variable is an alias, write a reference in code (`"$value": "{color.red.700}"` / `var(--color-red-700)`), not the resolved value. If `get_variable_defs` yields only a flattened value, treat it as case 3. Write a reference only when the referenced token exists in the store; otherwise skip by default and flag it, and add the primitive alongside only on per-item confirmation.
2. Primitive raw→raw (a `color/gray/100` hex difference) is edited as a raw value.
3. Semantic-integrity conflict — the code token is an alias but Figma holds a raw override, or code has no reference target: pulling would flatten the semantic. Skip by default and flag; overwrite only on separate per-item confirmation.
4. Anything else — for example code stores a semantic slot as a raw value and Figma has a different raw: handle as raw→raw when no reference structure is at stake, but if the slot belongs to the semantic hierarchy (`color/{brand,fg,surface,line,feedback}/*`), skip by default and flag, so a raw value does not become entrenched by accident.

## check procedure (read-only)

1. Read the store and the active tab's variables via `get_variable_defs`.
2. Output the drift report: code-only, Figma-only, value mismatches. No edits, no questions.
3. For Figma-only tokens, include a "token code suggestions" block — copy-pastable CSS or DTCG snippets with the reference-preservation rules applied.
4. Close with "run `/oh-my-joy:sync` to resolve by choosing directions, or `/oh-my-joy:sync push` to push code as is".

## Usage

<example>
```
/oh-my-joy:sync                                  # = sync (interactive: asks the direction per class)
/oh-my-joy:sync check                            # drift report + token code suggestions (read-only)
/oh-my-joy:sync push                             # bulk code→Figma without questions (explicit code-wins)
/oh-my-joy:sync extract https://figma.com/design/...   # Figma variables → CSS custom properties bootstrap
/oh-my-joy:sync push --tokens shared/tokens/tokens.json
/oh-my-joy:sync check --tokens src/tokens/colors.css   # CSS stores are supported too
```
</example>

Before running: open the target design-system file as the active tab in the desktop app (duplicate viewer-permission files first).
