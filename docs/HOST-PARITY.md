# Claude Code and Codex capability inventory

OMJ supports both hosts from one repository. Workflow names alone are insufficient: the adapter must preserve the actual operation, approval scope, and evidence. This inventory covers every Claude entry point and the host-specific setup assets as of 2026-09-08.

| Capability | Claude Code | Codex | Contract / validation |
| --- | --- | --- | --- |
| Interview, plan, spec alias, execution/resume | `commands/deep-interview.md`, `ralplan.md`, `spec.md`, `ultragoal.md` | matching `skills/*/SKILL.md` adapters | Shared command contracts and goal-state tests |
| Review, verification, visual fix, token sync, shipping, setup | matching `commands/*.md` | all six matching adapters | Every adapter routes to the canonical contract or an explicit host mapping |
| Implementer, critic, design QA | `agents/*.md` | three internal role skills, dispatched through available native agent roles | Each adapter reads its shared agent contract |
| Frontend fundamentals and references | bundled skill | same bundled skill | One shared rubric |
| Repository operating rules | root `CLAUDE.md` | root `AGENTS.md` loads the same contract | Instructions verified in native Codex prompt input |
| Maintainer release | repo-local `/release` | repo-local `$oh-my-joy:release` in `.agents/skills/release/` | [Shared release contract](RELEASING.md), native skill discovery |
| Release readiness / stale-install diagnosis | `.claude/skills/release-checklist/` | `.agents/skills/release-checklist/` | Both hosts' caches, tag target, Release inventory hash, session readback |
| Project declaration and design documentation | setup scaffolds fe-context and optional design doc | same selected scaffolds in Codex setup | Existing rules are linked, acceptance axes remain project-owned |
| Dependency installation / doctor | selected Claude plugin, MCP, browser tools | selected verified Codex plugin/MCP commands and browser tools | Registration and actual exposed capability reported separately |
| Frontend advisory hooks | Edit/Write-family `file_path` payload | native `apply_patch` command parser plus selected canonical checks | Real subprocess tests, nested cwd, renamed files, silent/escape cases |
| Answer style | opt-in output-style selection | opt-in project instruction block plus the same copied style body | Preserves effective AGENTS override and all unrelated instructions |
| Session status indicators | copied Claude HUD bundle | native Codex CLI `tui.status_line` | Exact supported config accepted by native app-server readback |
| Optional support / setup receipt | explicit star choice and setup receipt | same explicit choice; project-local receipt | No implicit external mutation; check mode stays read-only |

The two maintainer skills are repository-local: native `skills/list` reports `scope: repo`, `pluginId: null`, and their `.agents/skills/` paths in this checkout, and neither appears when the working directory is `/tmp`. They do not expand the published ten-workflow plugin inventory.

## Repaired behavioral gaps

- `fix --commit` now actually commits after a passing recheck, uses a feature branch and explicit paths, and reports its commit hash on both hosts.
- `ship` preserves normal fast-forward pushes. An explicit or unambiguous established base is reused; only a real unresolved base choice asks the user.
- `sync` loads the installed Figma workflow before writes and creates or updates the canonical token mapping document during extraction.
- The Codex hook adapter translates the current `tool_input.command` payload; copying Claude's `file_path` implementation alone did not produce warnings.
- Release output no longer suggests a second branch creation or broad staging. Inventory hashes exclude runtime state so it cannot masquerade as changed released content.

## Runtime boundaries

[Codex project skills](https://learn.chatgpt.com/ko-KR/docs/build-skills) use `.agents/skills/`. The plugin's own published skills remain under the manifest's `skills/` directory; no duplicate maintainer copy is added under `.codex/skills/`.

[Codex hooks](https://learn.chatgpt.com/docs/hooks) and [project instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md) supply the supported equivalents for event advice and response conventions. Hooks are advisory, not exhaustive enforcement; unknown shell writes and unsupported event paths are not guessed. [Codex setup](CODEX-SETUP.md) defines the exact copied files and opt-in registration.

The [Codex TUI footer](https://learn.chatgpt.com/docs/config-file/config-reference) is CLI-only. Codex App has no documented custom HUD slot or Claude-style output-style picker. App users still share plugin skills, project instructions, and supported hooks. OMJ does not claim the Claude HUD bundle runs inside Codex or that host-specific quota displays are identical.

## Evidence

Local Codex CLI 0.153.4 accepted both maintainer skills through initialized app-server `skills/list` with `forceReload: true`, including the repository-only scope. A non-persistent configuration override was read back with the exact five selected status indicators. Native `hooks/list` also discovered the project handler from a nested cwd and reported it as enabled but untrusted; configuration and project trust do not bypass per-hook trust. No model turn, plugin installation, user-global configuration update, or release was needed for these checks.

`tests/host-parity.test.mjs` covers the entry-point inventory, references, and opt-in setup assets. `tests/hooks/codex-post-tool-use.test.mjs` runs copied hook installations as subprocesses. The hook tests include a twelve-level nested cwd. The Windows PowerShell command is supplied through `commandWindows`; Windows execution and trusted native hook dispatch were not exercised on this macOS machine. Release and inventory regressions cover deterministic cuts and runtime-state exclusion. Host-visible changes still require a new session where the runtime does not reload them automatically.
