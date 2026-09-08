---
name: setup
description: Inspect OMJ readiness in Codex, then install selected integrations, project declarations, frontend hooks, answer style, and CLI status indicators. Check mode is read-only; setup changes are opt-in.
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Set up oh-my-joy for Codex

Read [the Codex setup contract](../../docs/CODEX-SETUP.md) completely. It maps every relevant Claude setup capability to an executable Codex action while preserving project declarations, existing configuration, and the user's selection.

## Modes

- `--help`: print usage and stop.
- `--check`: read-only inspection; do not ask questions, create files, install integrations, or change configuration.
- no flag: inspect, then collect selected changes in one structured multi-select question. If the current request already names the selected setup actions, use that authorization without asking again.

## Execution

1. Inspect the installed OMJ plugin, available tools, project trust, project declarations, Codex hooks, answer-style instructions, CLI footer, and native parallel-agent availability. Distinguish registration from a working integration.
2. Present concrete missing items with their exact files or installation commands. Install only selected integrations; no guessed marketplace IDs, MCP URLs, or unrelated global settings changes.
3. Scaffold accepted `.omj/fe-context.md`, optional `docs/DESIGN.md`, and local ignores. Keep acceptance axes and verification commands as project-owned declarations, not guesses.
4. For selected frontend hooks, copy the Codex adapter and selected canonical checks, merge the provided project hook registration, and smoke-test both a warning and a silent case. Never copy Claude input handling as if it were a Codex adapter.
5. For selected answer style, copy the shared style body into `.omj/answer-style.md` and add its managed read instruction to the effective root `AGENTS.override.md` or `AGENTS.md`. For a selected CLI footer, merge `[tui].status_line` in the project config. These choices preserve unrelated instructions/configuration and never replace native model instructions.
6. Verify every selected item's actual files, content, and supported configuration. Record only project-local setup state and clearly identify a session restart or a host UI limitation.

In Codex App, use the same skills, project instructions, and supported hook paths. A terminal footer is CLI-only; do not claim it renders in the App. Optional GitHub support follows the common explicit star choice described in the setup contract and never blocks setup.

Report present, missing, configured-but-unverified, and changed items with evidence. Start concrete work with `$oh-my-joy:ralplan`; use `$oh-my-joy:deep-interview` for unclear requirements. `$oh-my-joy:spec` remains a compatibility alias.
