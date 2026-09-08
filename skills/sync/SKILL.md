---
name: sync
description: Check or resolve drift between file-based design tokens and Figma Variables, including Figma-to-CSS bootstrap. Use for explicit token check, sync, push, or extract requests; preserve aliases and ask before conflict-direction changes.
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Sync design tokens with Figma

Compare a file-based token store with the active Figma file and either report drift or resolve it in the direction the user chooses. Code is the default source of truth, but never silently settle conflicts or delete tokens.

## Modes

- `check`: read-only drift report. This is the safe default when the request does not explicitly authorize writes.
- `sync`: group drift by class and use structured user input once to choose each class's direction.
- `push`: explicit code-wins operation; create or update only affected Figma variables without questions. It does not authorize deletion of Figma-only variables.
- `extract <figma-url>`: bootstrap Figma Variables into CSS custom-property files.

Accept `--tokens <path>`. Otherwise detect the store in the order declared by `frontend-fundamentals/references/fe-acceptance.md`: `.omj/fe-context.md` `tokensPath`, `shared/tokens/tokens.json`, then CSS custom properties. Tailwind configuration can describe a token system but is not a sync target; use `extract` to create a file store.

Use the Figma integration available in the current Codex session. The target is the active tab in Figma desktop; a URL identifies which file the user should open, not an alternate API address. If the integration is missing, disconnected, or lacks edit access, explain that the desktop file must be active and editable (duplicate viewer-only files) and stop before mutation.

## Store mapping

- DTCG JSON uses slash names and references such as `{color.red.700}`.
- CSS uses `--` names, maps `/` to `-`, and represents references as `var(--color-red-700)`.
- Preserve primitive-to-semantic aliases in both directions. Never replace a known alias with its resolved raw value.

## Check and classify

Read code tokens and Figma variable definitions, normalize their names without changing either source, and report:

1. value mismatches,
2. code-only tokens,
3. Figma-only tokens.

For `check`, make no edits and ask no questions. Include copyable code suggestions for Figma-only tokens while applying the alias rules below.

For `sync`, ask at most one structured question per non-empty class, in a single prompt when the UI supports it:

- mismatches: code -> Figma (recommended), Figma -> code, skip, or pick per item;
- code-only: create in Figma (recommended), remove from code, or skip;
- Figma-only: skip (recommended), add to code, or remove from Figma.

Deletion and semantic flattening are materially different choices: require a specific selection for them. Item-by-item resolution is opt-in, in groups of at most four; above twelve items recommend a bulk choice rather than producing a long prompt.

## Apply resolutions

- Code -> Figma: use the available Figma capability to create or update only affected variables. Create a missing referenced primitive before its alias.
- Figma -> code: use `apply_patch` to change only affected JSON nodes or CSS declarations, retaining comments, order, formatting, and unrelated user edits.
- Remove: delete only the selected tokens from the selected side.
- Skip: retain the item and count it as unresolved drift.

When pulling from Figma, write an alias only if its target exists in code. If Figma exposes only a flattened value for a code alias, or a semantic token would become a raw override, skip it by default and flag the semantic-integrity conflict. Add the missing primitive or flatten the semantic only after a separate item-specific choice.

## Extract

Read all variables from the active Figma file, preserve aliases, and group generated CSS by collection or category. Prefer a user-provided path or a path declared in `.omj/fe-context.md`; otherwise use `src/tokens/` only when it fits the repository layout.

Before changing an existing target, use structured user input to choose merge, overwrite, or abort. Overwrite requires explicit selection. Use `apply_patch` for both new and existing files. Update an existing `docs/design-tokens.md` mapping only when it is already part of the project convention; do not expand scope solely to create documentation.

## Result

Report counts by drift class and resolution direction, aliases preserved, files changed, Figma variables changed, and unresolved conflicts. External Figma writes require an explicit `sync`/`push` request or explicit conflict choice; a `check` request never authorizes them.
