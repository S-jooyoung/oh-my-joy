---
name: sync
description: Check or resolve drift between file-based design tokens and Figma Variables, including Figma-to-CSS bootstrap. Use for explicit token check, sync, push, or extract requests; preserve aliases and ask before conflict-direction changes.
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Sync design tokens with Figma

Read [the canonical sync command](../../commands/sync.md) completely before acting. When it routes token-store discovery through the frontend contract, read `../frontend-fundamentals/references/fe-acceptance.md` as well. Follow the canonical mode, direction, alias, conflict, deletion, extraction, and output contracts. This file only maps that contract onto Codex surfaces.

## Codex adapter

- Use repository reads to inspect token files and `apply_patch` for code-side writes. Use native structured user input for the canonical grouped conflict choices; `check` remains read-only and asks no questions.
- Use the active editable Figma desktop file through the integration exposed in the current Codex session. Before any code-to-Figma creation, update, or deletion, load the installed `$figma:figma-use` workflow guidance and follow its current write procedure. Do not guess tool identifiers or mutation calls. If that workflow is unavailable, the integration is disconnected, or the file lacks edit permission, stop before the Figma write.
- External Figma writes require an explicit `sync` or `push` request, or an explicit conflict-direction choice. Preserve `push` as code-wins without implicit deletion and preserve `sync` as the grouped bidirectional resolution flow.
- For `extract`, preserve aliases and generate the canonical CSS token files. Create or update `docs/design-tokens.md` at the canonical path with the variable-to-CSS mapping table. If a target already exists, apply the canonical merge, overwrite, or abort choice before changing it.

Report actual drift and mutation counts, changed files, preserved aliases, and unresolved conflicts. Never claim a Figma mutation when the host could not perform and read back the write.
