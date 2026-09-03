---
description: OMJ dependency check + scaffolding — inspects playwright-cli/MCP, Figma MCP, Context7, the Agent Teams flag, and the OMJ answer style, and proposes installing .omj/fe-context.md, the token-guard hooks, and the OMJ HUD statusline (opt-in)
argument-hint: "[--check] (inspect only) | [--help]"
allowed-tools: Read, Write, Edit, AskUserQuestion, Bash(command -v:*), Bash(claude plugin list:*), Bash(claude plugin install figma@claude-plugins-official:*), Bash(claude plugin install context7-plugin@context7-marketplace:*), Bash(npm i -g playwright-cli:*), Bash(test:*), Bash(grep:*), Bash(diff:*), Bash(cp "${CLAUDE_PLUGIN_ROOT}/templates/hooks/":*), Bash(mkdir -p .claude/hooks:*), Bash(cp -R "${CLAUDE_PLUGIN_ROOT}/hud/":*), Bash(mkdir -p ~/.claude/omj-hud:*), Bash(sh ~/.claude/omj-hud/omj-hud-cache.sh:*), Bash(gh auth status:*), Bash(gh api user/starred/S-jooyoung/oh-my-joy), Bash(gh api user/starred/S-jooyoung/oh-my-joy -X PUT)
---

# /oh-my-joy:setup — Dependency doctor and scaffolding

Inspect the optional dependencies OMJ leans on, guide the installation of anything missing, and scaffold the project declaration. Already-installed items are left untouched. Project declarations (`.omj/fe-context.md`), the token-guard hooks, the HUD, the Agent Teams flag, and the answer style are all opt-in and installed only here — the plugin changes nothing in a project or a user config on its own, because a plugin that did would fire in every repo it is enabled in.

Users run this directly; `/oh-my-joy:spec` also suggests it once when it sees no setup trace (no `.omj/` in the repo and no `~/.claude/.omj-setup.json`), because a skipped setup is the usual root cause of a missing fe-context or hook chain.

## Flags

- `--help` — print Usage and stop.
- `--check` — print the inspection table only (read-only).
- (none) — inspect, then ask about installing or creating the missing items.

## Step 1 — Inspection (read-only)

Detect each item and print a table with present / missing / optional:

| Item | Used for | Detection |
| --- | --- | --- |
| `playwright-cli` or playwright MCP | `/oh-my-joy:verify` and `/oh-my-joy:fix` browser mode (cli first, MCP fallback) | `command -v playwright-cli`; otherwise session tools named `mcp__playwright__*` |
| Official Figma Dev Mode MCP | `/oh-my-joy:spec` figma track, `/oh-my-joy:sync` | `claude plugin list \| grep -i figma` |
| Context7 | current Next.js docs in `/oh-my-joy:spec` and `/oh-my-joy:review` (optional) | `claude plugin list \| grep -i context7` |
| Agent Teams flag (opt-in) | the agent-team execution lane | `grep CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS ~/.claude/settings.json` — optional when absent |
| OMJ answer style (opt-in) | natural, learner-friendly answers in your language | `grep '"outputStyle"' ~/.claude/settings.json .claude/settings.local.json` — optional when absent |
| `oh-my-joy:frontend-fundamentals` | the spec and review rubric (bundled) | present whenever OMJ is installed |
| `.omj/fe-context.md` | project acceptance, token, verification declarations | `test -f .omj/fe-context.md` — optional; scaffolding proposed below |
| Token store | target of `/oh-my-joy:sync` | detect in the order of `references/fe-acceptance.md` (fe-context `tokensPath` → `shared/tokens/tokens.json` → CSS-based systems). Only `/oh-my-joy:sync` needs a file store; `/oh-my-joy:spec` works without one |
| Token-guard hooks (opt-in) | on-save hardcoding and Story warnings | `.claude/hooks/check-design-tokens.mjs` exists in the project |
| OMJ HUD statusline (opt-in) | model, usage, and context statusLine (user-global) | `grep omj-hud ~/.claude/settings.json` |

Figma needs more than the plugin: Dev Mode MCP has to be enabled in the Figma desktop app, and viewer-permission files deny access, so a Duplicate is needed — say so during inspection. If the `claude` CLI is unavailable, skip detection and point to `/mcp` and `/plugin` for manual checks.

## Step 2 — Install and scaffold (missing items, not with `--check`)

Gather the missing items into one `AskUserQuestion` (multiSelect) — "pick the items to install or create now" — bundling dependencies and scaffolding into at most two questions and never repeating per-item prompts. Execute only the selected items; for the rest, print the manual commands.

- Figma MCP → `claude plugin install figma@claude-plugins-official`, plus "enable Dev Mode MCP in the Figma desktop app".
- Context7 → `claude plugin install context7-plugin@context7-marketplace`.
- No capture backend → `npm i -g playwright-cli`, or enable the playwright MCP (either one suffices).
- Agent Teams flag → on consent, `Edit` `~/.claude/settings.json` to add `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` under `env`, and say it applies from the next session. The feature is experimental; without it the agent-team lane degrades to subagents and inline, so this is a convenience, not a requirement.
- OMJ answer style → on consent, `Edit` `~/.claude/settings.json` to set `"outputStyle": "oh-my-joy"` (the name the `/config` picker shows for this plugin's style; if the picker shows a namespaced name, use that). Warn before overwriting an existing custom style, and say it applies from the next session or after `/clear`. When declined, print how to pick it in `/config`.
- `.omj/fe-context.md` → first look for existing rule documents: `AGENTS.md`, `.claude/rules/*.md`, `.github/copilot-instructions.md`, the FE section of CLAUDE.md. If any exist, generate fe-context that points at them via `contextDocs:` rather than duplicating their content — a second copy is a drift source. Otherwise scan the project (message directories, token-system shape, theme classes, Storybook config, `package.json` scripts) and `Write` a draft. Fill `tokensPath` only when a file-based store is detected; leave `acceptance:` an empty list; record detected candidates as comments only (`# detected: src/messages/{ko,en}.json — the project decides whether simultaneous locale updates become an axis`); scaffold `verifyCommands:` the same way, with the detected `typecheck`/`lint`/`test` scripts as comments; present `decisions:` as an empty scaffold with a comment. The plugin declares no axis on a project's behalf. Format canon: `references/fe-acceptance.md`.
- `.gitignore` → alongside fe-context, guide adding `.omj/baselines/` (post-auth screenshots may contain personal data). Warn against ignoring `.omj/` wholesale, which would drop the committed fe-context.
- `docs/DESIGN.md` (optional) → propose only after fe-context was agreed: an empty scaffold with comment guidance for brand personality, color and spacing usage, composition rules, and Figma layer naming; link it in fe-context as `designDocPath:`.
- Token-guard hooks → propose `check-design-tokens.mjs` by default and `check-story-exists.mjs` only when Storybook signals exist (a `.storybook/` directory, `@storybook/*` dependencies, `*.stories.*` files) — the hook no-ops without a declaration, but proposing it to a project without the practice is noise. On consent:
  1. Copy the selected scripts from the plugin canon into the project's `.claude/hooks/`: `mkdir -p .claude/hooks && cp "${CLAUDE_PLUGIN_ROOT}/templates/hooks/"check-design-tokens.mjs .claude/hooks/` (repo-relative `templates/hooks/`). The source is plugin-root-relative because the project has no `templates/`; the destination is a copy because the project's settings.json cannot resolve `${CLAUDE_PLUGIN_ROOT}` and plugin-cache absolute paths break on every update.
  2. Register the scripts in the project's `.claude/settings.json` under `hooks.PostToolUse` with matcher `Edit|Write|MultiEdit|NotebookEdit` and relative commands (`node .claude/hooks/check-design-tokens.mjs`) — the same four tools the scripts treat as mutating, so a narrower matcher cannot let a save slip past.
  3. The hooks no-op without fe-context declarations (`tokensPath`, `storybook: true`), so recommend installing them together with fe-context.
  4. On rerun, if `${CLAUDE_PLUGIN_ROOT}/templates/hooks/` differs from the `.claude/hooks/` copies (`diff`), announce "hook script update available" and overwrite only on consent.
- OMJ HUD statusline → on consent:
  1. `mkdir -p ~/.claude/omj-hud && cp -R "${CLAUDE_PLUGIN_ROOT}/hud/". ~/.claude/omj-hud/` (a copy, for the same reasons as the hooks).
  2. `Edit` `~/.claude/settings.json` to set `statusLine` to `{"type": "command", "command": "sh ~/.claude/omj-hud/omj-hud-cache.sh ~/.claude/omj-hud/omj-hud.mjs"}`; warn before overwriting an existing custom statusLine.
  3. Smoke-check by piping `{"session_id":"setup-check"}` into `sh ~/.claude/omj-hud/omj-hud-cache.sh ~/.claude/omj-hud/omj-hud.mjs` and confirming a rendered line.
  4. On rerun, if `${CLAUDE_PLUGIN_ROOT}/hud/` differs from the copy (`diff -r`), announce "HUD update available" and overwrite only on consent. Attribution and limitations: `hud/README.md`, `NOTICE.md`.

Plugin installs and hook registrations take effect from the next session — say so after installing.

## Step 3 — Wrap-up

- Print the inspection summary and "start with `/oh-my-joy:spec <figma-url|task>`; when the goal is still fuzzy, `/oh-my-joy:deep-interview` first".
- Optionally record `{"setupCompleted": "<today>"}` in `~/.claude/.omj-setup.json`, so reruns can fast-path with "already inspected; inspect again?".
- GitHub star (optional): if `gh auth status` succeeds, check `gh api user/starred/S-jooyoung/oh-my-joy`. Already starred (exit 0) → say nothing. Otherwise ask once via `AskUserQuestion` ("If OMJ helps you, would you support it with a GitHub star?" — star it / no thanks / later) and run `gh api user/starred/S-jooyoung/oh-my-joy -X PUT` only on "star it". An API failure is ignored; a star never blocks setup. With `gh` missing or unauthenticated, print `https://github.com/S-jooyoung/oh-my-joy` without asking.

## Usage

<example>
```
/oh-my-joy:setup            dependency check + install/scaffolding guide for anything missing
/oh-my-joy:setup --check    inspection table only (read-only)
/oh-my-joy:setup --help     this help
```
</example>
