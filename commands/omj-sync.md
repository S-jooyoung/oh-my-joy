---
description: Sync design tokens code↔Figma — groups drift by class and asks the direction to resolve each (code is the default SoT). extract bootstraps Figma variables into CSS custom properties
argument-hint: "[sync|check|push|extract <figma-url>] [--tokens <path>]"
allowed-tools: Read, Edit, Write, Grep, Glob, Skill, AskUserQuestion, mcp__plugin_figma_figma__get_variable_defs, mcp__plugin_figma_figma__use_figma, mcp__figma__get_variable_defs, mcp__figma__use_figma
---

# /omj-sync — Design token sync (code ↔ Figma, interactive)

Computes drift between a file-based token store (**`tokens.json` (W3C DTCG) or CSS custom properties `*.css`**) and Figma Variables, and resolves it by **asking the user the direction for each conflict**. `extract` is the bootstrap mode for turning Figma variables into code for the first time.

> **Principle: code is the default SoT; the user picks the direction for conflicts.** The plugin never hard-wires a direction — when drift exists, it groups by class and asks the direction (code→Figma / Figma→code / skip) via `AskUserQuestion`. The **first (default) choice of every question is code authority** — for value mismatches and code-only tokens it is "code→Figma", for Figma-only tokens it is the conservative "skip" (leaving code as SoT untouched). Absent-mindedly hitting enter still yields the same safe result as the old code-wins. `push` is the fast path that explicitly chooses "code wins" without the questions; `check` is a read-only diagnostic.

> ⚠️ **Target file = the currently active tab of the Figma desktop app.** `use_figma`/`get_variable_defs` operate on the active-tab file, so open the **design-system file to sync as the active tab** before running (a URL cannot address the target file — the URL in `extract <figma-url>` is likewise a marker meaning "open this file as the active tab"). `sync`·`push`·`extract` are **active ops** — the Figma desktop app must be running and they run outside Plan mode. `check` is **read-only by intent** — but since `allowed-tools` is per-command, the four modes share permissions; the read-only guarantee is enforced by the "per-mode permission discipline" below, not the permission layer.
>
> **Edit-permission prerequisite (measured)**: Figma variable/node MCP access **requires edit permission** — viewer-permission files (shared tutorials, handoff files, …) are denied by `get_variable_defs`. In that case, use **Duplicate** in Figma and open the copy as the active tab.

## Arguments (modes)

- `sync` (**default** — bare `/omj-sync`) — interactive mode: computes drift and **asks the direction per class** to resolve.
- `check` — outputs only a **read-only drift report** of Figma Variables ↔ token store differences (no edits, no questions).
- `push` — bulk create/update the token store into the active tab's Figma Variables without questions (**explicit code-wins fast path**).
- `extract <figma-url>` — **Figma → code bootstrap**: extracts all variables of the active tab into CSS custom properties as new token files (procedure below).
- `--tokens <path>` — token store path. When omitted, follow the **token-system detection order** in `references/fe-acceptance.md` (the SoT — not restated here), but `sync`/`push`/`extract` target **file-based stores only** (`.json` DTCG or `.css` custom properties). Systems that are not file stores (like Tailwind config theme extensions) may be detected but are not sync targets; bootstrap those with `extract`. `.json` is treated as DTCG, `.css` as a CSS custom-properties store.

> **Per-mode permission discipline (enforced by this body).** `allowed-tools` is per-command so all four modes share the same permissions, but: `check` **never calls `Edit`/`Write`/`use_figma`** (read-only). `sync`/`push` use only `Edit`+`use_figma`. **`Write` is `extract`-only** — calling `Write` from `sync`/`check`/`push` is forbidden (existing stores are always edited surgically with `Edit`). In Plan mode the write tools are blocked and it fails gracefully.

## The two token-store shapes

**A. `tokens.json` (W3C DTCG)** — example hierarchy (structure varies by project):
- **Primitive** — raw scales like `color/{scale}/{step}` (e.g. `color/gray/100`).
- **Semantic** — `color/{brand,fg,surface,line,feedback}/*` (alias references to Primitives, e.g. `{color.red.700}`). Design work uses semantic only.
- **Theme / Typography / Radius / Shadow / FontFamily** — slot based.

**B. CSS custom properties (`*.css`)** — the `:root { --color-gray-100: #f1f3f5; --color-fg-primary: var(--color-gray-900); }` shape. Parsing rules: declarations starting with `--` are tokens; `var(--x)` values are treated as **aliases (references)** (isomorphic to DTCG `{x}` references). Compare via the mapping Figma variable name `color/gray/100` ↔ CSS `--color-gray-100` (`/`→`-`).

## extract procedure (Figma → CSS bootstrap)

1. Confirm the target Figma file is open as the active tab, then read all variables with `get_variable_defs` (if denied, advise edit permission / duplicate — graceful).
2. **Conversion rules**: generate CSS variable names with `/`→`-` (`color/brand/primary` → `--color-brand-primary`). **Preserve the primitive→semantic reference structure** — if a semantic variable is an alias in Figma, write CSS as a `var(--primitive-*)` reference too (no duplication of resolved raw values).
3. **File split**: split by collection/category (e.g. `src/tokens/colors.css`, `src/tokens/spacing.css` — actual paths prefer `--tokens`/fe-context declarations; otherwise propose `src/tokens/`).
4. **Overwrite guard**: if a target file already exists, confirm overwrite/merge/abort via `AskUserQuestion` (irreversible + not safely inferable — satisfies ⑪). `Write` new files only.
5. **Mapping table**: create/update a Figma variable name ↔ CSS variable name ↔ value/reference table in `docs/design-tokens.md` (`Edit` if the file exists).
6. Summary: extracted variable count (per collection), preserved alias count, created file list. Advise continuing routine drift management with `check`/`sync`.

## sync procedure (interactive default)

1. **Drift computation (read-only)**: parse the token store with `Read` (per shape A/B), read active-tab Variables with `get_variable_defs`, and compare. Group drift into three classes — **value mismatch** (exists on both, differs), **code-only**, **Figma-only**. (If Figma is unconnected/unauthorized, do not die with an error — advise "start the desktop app and open the target file as the active tab (duplicate viewer files)" and stop — graceful.)
2. **If there is no drift**, finish with "in sync — no drift to resolve" (ask nothing).
3. **If there is drift, ask a single `AskUserQuestion`** with one question per non-empty class (≤3 questions = one modal; never per token). The **first option of each question is the code-authority default**:
   - **Q1 value mismatches (N)**: ① `code→Figma (code wins)` [default] · ② `Figma→code` · ③ `skip` · ④ `pick per item`
   - **Q2 code-only (M)**: ① `create in Figma (code→Figma)` [default] · ② `remove from code` · ③ `skip`
   - **Q3 Figma-only (K)**: ① `skip` [default·conservative] · ② `add to code (Figma→code)` · ③ `remove from Figma`
     - (Why only Q3 defaults to `skip`: skipping Figma-only tokens keeps code=SoT untouched — the non-destructive reading of "code authority". No forced auto-create/delete.)
4. **Apply the resolution actions** per class as chosen:
   - `code→Figma` / `create in Figma`: **first invoke the `figma-use` skill via `Skill` (MANDATORY)** → with `use_figma`, target-create/update **only the affected variables** (not a full collection rebuild). Semantics **reference Primitives as aliases** (no value duplication). **Ordering rule**: if a Primitive referenced by a semantic alias does not yet exist in Figma, **create/ensure that Primitive first**, then the semantic (prevents broken aliases referencing missing variables).
   - `Figma→code` / `add to code`: `Edit` **only the affected node/declaration surgically** in the token store (no whole-file `Write` — preserve order/format/comments). Observe the reference-preservation guardrails below (common to A·B).
   - `remove from Figma` / `remove from code`: `use_figma` deletion / `Edit` node/declaration removal respectively.
   - `skip`: no-op. Kept in the summary's "unresolved drift".
5. **`pick per item` is opt-in only**: if chosen, drill into that class with follow-up `AskUserQuestion`s (≤4 items per modal). If the total count is large (over ~12), warn "too many — handling in bulk" and fall back to bulk (prompt-fatigue guard). Per-item is not the default path.
6. **Summary**: print resolved counts (per direction) and the **unresolved drift** count.

### Reference-preservation guardrails (hard rules for Figma→code pulls — DTCG·CSS alike)

Flattening semantic tokens into raw hex when pulling Figma values back into code silently breaks the token system — always obey the following (in CSS stores, read `{x}` references as `var(--x)`).

1. **If the Figma variable is an alias**, record a **reference** in code too (DTCG `"$value": "{color.red.700}"` / CSS `var(--color-red-700)`), not the resolved raw value. If `get_variable_defs` cannot yield the alias target and only has a flattened value, treat it as case 3. **Only record a reference when the referenced token actually exists in the code store** — otherwise it would dangle, so **default-skip + explicit flag** (on per-item confirmation, add that Primitive alongside).
2. **Primitive raw→raw** (e.g. a `color/gray/100` hex difference) is safely `Edit`ed as a raw value.
3. **semantic-integrity conflict** — if the code token is an **alias** but the Figma side is a **raw override** (or code has no reference target), pulling would flatten the semantic to raw and break the system. **Default-skip + explicit flag**; overwrite only upon separate per-item confirmation.
4. **Everything else (not matching the three cases above)** — e.g. code stores a semantic slot as raw (not an alias) and Figma has a different raw value. If no reference structure is at stake, handle as a raw→raw `Edit`, but if the slot name belongs to the semantic hierarchy (`color/{brand,fg,surface,line,feedback}/*` etc.), **default-skip + explicit flag** and leave it to the user (prevents accidental raw entrenchment).

## check procedure (read-only)

1. Read the token store and the active tab's Variables via `get_variable_defs`.
2. Compare both and output a **drift report**: code-only / Figma-only / value mismatches. **No edits, no questions.**
3. **For Figma-only tokens, include a "token code suggestions" block** — copy-pastable CSS (or DTCG) snippets (reference-preservation rules applied). The user applies them or hands off to `sync`.
4. Conclusion: advise "run `/omj-sync` (sync) to resolve by choosing directions, or `/omj-sync push` to push code as is".

## Usage

```
/omj-sync                                  # = sync (interactive: asks the direction per class)
/omj-sync check                            # drift report + token code suggestions (read-only)
/omj-sync push                             # bulk code→Figma without questions (explicit code-wins)
/omj-sync extract https://figma.com/design/...   # Figma variables → CSS custom properties bootstrap
/omj-sync push --tokens shared/tokens/tokens.json
/omj-sync check --tokens src/tokens/colors.css   # CSS stores also supported
```
> Before running: open the target Figma design-system file as the **active tab** in the desktop app (duplicate viewer-permission files first).
