---
name: setup
description: Inspect Codex plugin, MCP, browser, Figma, and project readiness for oh-my-joy, then optionally scaffold project-local .omj or .codex configuration. Use for OMJ setup or doctor requests; never alter user-global Codex configuration.
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Set up oh-my-joy for Codex

Inspect Codex and the consuming repository, report what is ready, and offer narrowly scoped project scaffolding. Setup is opt-in: merely loading OMJ must not change any project or user configuration.

## Modes

- `--help`: print usage and stop.
- `--check`: inspection only; do not ask questions or write files.
- no flag: inspect, then offer missing project-local scaffolding through structured user input.

## Inspect

Use read-only commands and current session capabilities to check:

| Item | Detection and purpose |
| --- | --- |
| OMJ Codex plugin | `codex plugin list --marketplace omj --json`; confirms the installed plugin and version without letting an unrelated broken marketplace hide OMJ's state |
| MCP integrations | `codex mcp list --json` plus tools exposed to this session; identify Figma and optional documentation integrations |
| Browser capture | browser/Chrome/computer-use tools, Playwright MCP, or `command -v playwright-cli`; used by verify and fix |
| Figma readiness | a configured Figma integration and exposed Figma tools; remind the user that the desktop file must be active and editable |
| Frontend fundamentals | bundled OMJ skill availability |
| Project declaration | `.omj/fe-context.md` |
| Token store | detection order in `frontend-fundamentals/references/fe-acceptance.md` |
| Project hooks | `.codex/hooks.json` and any referenced project-local scripts |

Do not infer live integration access merely from registration. If useful and read-only, perform a lightweight capability call; otherwise distinguish "configured" from "verified in this session".

Do not inspect or modify Claude settings for Codex setup. Do not modify `~/.codex/config.toml`, install plugins, add MCP servers, change feature flags, or write any other user-global file. For a missing global dependency, print the exact `codex plugin`, `codex mcp`, or package-manager command as guidance only.

## Offer project scaffolding

Outside `--check`, collect eligible project-local items into one structured multi-select prompt. Modify only selected items, and only below the consuming repository's `.omj/` or `.codex/` directories.

### `.omj/fe-context.md`

First inspect `AGENTS.md`, repository rules, existing agent instructions, Storybook signals, token files, message directories, theme classes, and `package.json` scripts. When existing rule documents exist, reference them under `contextDocs:` rather than copying their contents.

Scaffold the format from `frontend-fundamentals/references/fe-acceptance.md`:

- populate `tokensPath` only for a detected file-based token store;
- leave `acceptance:` and `decisions:` empty, with detected candidates as comments only;
- leave detected `verifyCommands:` as comments until the project adopts them;
- never declare an acceptance axis on the project's behalf.

If baselines may contain authenticated or personal content, offer a project-local `.omj/.gitignore` containing `baselines/`. Do not edit the repository-root `.gitignore`, and never ignore all of `.omj/`.

### `.codex/hooks.json`

Offer hooks only when Codex hooks are supported by the installed version and the current project has opted in. Copy the selected canonical hook scripts into `.codex/hooks/`, then register those project-local paths in `.codex/hooks.json` using the installed Codex hook schema. Propose the design-token hook by default only when a token store is declared; propose the Story hook only when Storybook signals exist.

Before changing an existing hook file or script, inspect it and preserve unrelated entries and user edits. If the installed schema cannot be confirmed, do not invent configuration; print the limitation and skip hook registration. Never create a plugin-shipped global hook or an always-on hook outside the consuming project.

## Finish

Report present, missing, configured-but-unverified, and created items. State which global setup commands remain manual and which project files changed. Recommend starting with `$oh-my-joy:ralplan`; use `$oh-my-joy:deep-interview` first when the goal is unclear. `$oh-my-joy:spec` remains the compatibility alias.
