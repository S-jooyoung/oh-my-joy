---
description: OMJ dependency check + scaffolding — inspects playwright-cli/MCP, Figma MCP, Context7, and proposes installing .omj/fe-context.md and the token-guard hooks (opt-in)
argument-hint: "[--check] (inspect only) | [--help]"
allowed-tools: Read, Write, Edit, AskUserQuestion, Bash(command -v:*), Bash(claude plugin list:*), Bash(claude plugin install figma@claude-plugins-official:*), Bash(claude plugin install context7-plugin@context7-marketplace:*), Bash(npm i -g playwright-cli:*), Bash(test:*), Bash(grep:*), Bash(cp "${CLAUDE_PLUGIN_ROOT}/templates/hooks/":*), Bash(mkdir -p .claude/hooks:*), Bash(gh auth status:*), Bash(gh api user/starred/S-jooyoung/oh-my-joy), Bash(gh api user/starred/S-jooyoung/oh-my-joy -X PUT)
---

# /oh-my-joy:setup — Dependency doctor + install/scaffolding guide

Inspects the **optional dependencies** OMJ leans on and guides installation for anything missing. **Already-installed items are left untouched and reported with a ✓ only.** Running it once before first use is a good idea. Project declarations (`.omj/fe-context.md`) and the token-guard hooks are scaffolded **only here** (true opt-in — the plugin auto-installs nothing into consuming projects).

> **Entry paths**: users invoke this command directly, but `/oh-my-joy:spec` also suggests it in one line at the end of a spec when it detects no setup trace (no `.omj/` in the repo + no `~/.claude/.omj-setup.json` marker) — in dogfood measurements, skipped setup was the root cause of the missing fe-context/hook chain.

## Flags

- `--help` → print the usage below and stop.
- `--check` → print the inspection table only and stop (read-only, no install/scaffolding proposals).
- (none) → after inspection, ask about installing/creating the missing items and guide.

## Step 1 — Inspection (read-only detection)

Detect each item and report a ✓(present)/✗(missing)/➖(optional, fine without) table:

| Dependency | Used for | Detection |
| --- | --- | --- |
| `playwright-cli` **or** playwright MCP | `/oh-my-joy:verify`·`/oh-my-joy:fix` visual verification (cli first, MCP fallback) | `command -v playwright-cli`; otherwise check session tools for `mcp__playwright__*` |
| Official Figma Dev Mode MCP | `/oh-my-joy:spec` figma primer·`/oh-my-joy:sync` | `claude plugin list \| grep -i figma` |
| Context7 | `/oh-my-joy:spec` latest Next.js docs (optional) | `claude plugin list \| grep -i context7` |
| `oh-my-joy:frontend-fundamentals` | implementation-spec rubric (bundled) | always present when OMJ is installed |
| `.omj/fe-context.md` | project acceptance/token/verification declarations | `test -f .omj/fe-context.md` (➖ — if missing, scaffolding proposed below) |
| Token store | target of `/oh-my-joy:sync` (sync·push·extract) | detect in order: fe-context `tokensPath` → `shared/tokens/tokens.json` → **CSS-based systems** (Tailwind `@utility`/`@theme`·`:root --*`) (`references/fe-acceptance.md` is the SoT). `/oh-my-joy:spec` works without a file store — **only `/oh-my-joy:sync` requires one** (bootstrap via `extract`) |
| Token-guard hooks (opt-in) | on-save hardcoding/Story warnings | existence of `.claude/hooks/check-design-tokens.mjs` in the consuming project |

> Figma requires more than plugin installation: **Dev Mode MCP must be enabled in the Figma desktop app** for the `/oh-my-joy:spec` figma primer·`/oh-my-joy:sync` to work, and **viewer-permission files are denied access**, so a Duplicate is needed — tell the user during inspection.
> If the `claude` CLI is unavailable, skip detection and point to manual checks (`/mcp`, `/plugin`) (graceful).

## Step 2 — Install/scaffolding guide (missing items; only when not `--check`)

Gather the missing items into **one `AskUserQuestion` (multiSelect)** asking "pick the items to install/create now" — bundle dependencies (Figma MCP·Context7·capture backend) and scaffolding (fe-context·DESIGN.md·hooks) into at most 2 questions, and **never repeat per-item prompts** (prompt-fatigue prevention, PRINCIPLES ⑪). Execute only the selected items via the procedures below; for unselected items, print the manual commands only:

- **Figma MCP missing** → `claude plugin install figma@claude-plugins-official` + note "Dev Mode MCP must be enabled in the Figma desktop app".
- **Context7 missing** → `claude plugin install context7-plugin@context7-marketplace`.
- **No capture backend** → guide playwright-cli installation (`npm i -g playwright-cli`) or enabling the playwright MCP (either one suffices — verify supports the fallback).
- **`.omj/fe-context.md` missing** → **first detect existing rule documents**: `AGENTS.md`, `.claude/rules/*.md`, `.github/copilot-instructions.md`, the FE section of CLAUDE.md. **If any exist, prefer reference-adoption over authoring new content** — generate fe-context that merely points at those documents via a `contextDocs:` list (no content duplication — duplicate SoT is a drift source, and in measurements the information fe-context targets already existed in such files). If none exist, scan the project as before (i18n message directories, token-system shape, theme classes, Storybook config) and `Write` a draft. **Rule (principle ⑩)**: fill `tokensPath` only when a file-based token store is actually detected, leave `acceptance:` an **empty list**, and record detected candidates **as comments only** — e.g. `# detected: src/messages/{ko,en}.json — the project decides whether simultaneous locale updates become an axis`. The plugin never auto-declares axes/rules. Also present the `decisions:` field (one line per recurrence-prevention decision/ADR) as an empty scaffold + comments — what actually improves review accuracy is the list of past decisions more than the token path. Format canon: `references/fe-acceptance.md`.
- **`.gitignore` tier guidance** → along with fe-context scaffolding, guide adding `.omj/baselines/` (post-auth screenshots — possible PII) and `.omj/goals/` (operational state of `/oh-my-joy:goal-loop` — accumulating command summaries/paths) to the consuming project's `.gitignore`. **Warn against ignoring `.omj/` wholesale** — that would also lose the committed `.omj/fe-context.md` (the project declaration). Specify only the two subdirectories.
- **(optional) `docs/DESIGN.md` draft** → propose only after fe-context creation was agreed: generate an **empty scaffold + comment guide** for brand personality, color/spacing usage context, component composition rules, and Figma layer naming conventions (the project fills the content). On creation, link it in fe-context as `designDocPath: docs/DESIGN.md`.
- **Token-guard hooks missing** → build the proposal **detection-based**: `check-design-tokens.mjs` is the default proposal; include `check-story-exists.mjs` **only when Storybook signals are detected** (a `.storybook/` directory, `@storybook/*` dependencies, `*.stories.*` files) — without signals, drop it from the list and only mention its existence (the hook itself is a no-op without fe-context declarations, a double safety, but proposing it to a project without the practice is noise in itself). On consent:
  1. Copy the selected scripts from the plugin hook canon `${CLAUDE_PLUGIN_ROOT}/templates/hooks/` (repo-relative `templates/hooks/`) into the consuming project's **`.claude/hooks/`** — in the shape `mkdir -p .claude/hooks && cp "${CLAUDE_PLUGIN_ROOT}/templates/hooks/"check-design-tokens.mjs .claude/hooks/` (selected scripts only; ensure the directory first so the copy cannot fail). The source must be plugin-root-relative — the consuming project's cwd has no `templates/`. Why **copy** instead of reference-registration: the consuming project's settings.json cannot resolve `${CLAUDE_PLUGIN_ROOT}`, and plugin-cache absolute paths break on every version update.
  2. Register both scripts in the consuming project's `.claude/settings.json` under `hooks.PostToolUse` with matcher `Edit|Write|MultiEdit|NotebookEdit`, using relative paths (`node .claude/hooks/check-design-tokens.mjs`) — the same set as the scripts' internal `MUTATING_TOOLS` four (a narrower matcher lets MultiEdit saves silently bypass the hook).
  3. The hooks are no-ops without fe-context declarations (`tokensPath`/`storybook: true`), so recommend installing them together with fe-context scaffolding.
  4. On rerun, if the canon in `${CLAUDE_PLUGIN_ROOT}/templates/hooks/` differs from the `.claude/hooks/` copies, announce "hook script update available" (overwrite only on consent).

> Plugin installs load commands/tools **from the next session** — after installing, announce "takes effect in a new session". Hook registration also fires from the next session.

## Step 3 — Wrap-up

- Inspection summary (✓/✗) and "now start with `/oh-my-joy:spec <figma-url|task>`".
- (optional) Record `{"setupCompleted": "<today>"}` in `~/.claude/.omj-setup.json` → reruns fast-path with "already inspected; inspect again?".
- **(optional) GitHub star suggestion** — if `gh auth status` succeeds, check whether already starred via `gh api user/starred/S-jooyoung/oh-my-joy`. **If already starred (exit 0), ask nothing and move on quietly.** Only when unstarred, ask once via `AskUserQuestion` "If OMJ helps you, would you support it with a GitHub star?" (star it / no thanks / later), and run `gh api user/starred/S-jooyoung/oh-my-joy -X PUT` only on "star it". **Move on quietly even if the API fails — a star never blocks setup completion in any case.** If gh is missing or unauthenticated, print the single line `https://github.com/S-jooyoung/oh-my-joy` without prompting.

## Usage

```
/oh-my-joy:setup            dependency check + install/scaffolding guide for anything missing
/oh-my-joy:setup --check    inspection table only (read-only)
/oh-my-joy:setup --help     this help
```
