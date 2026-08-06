# oh-my-joy (OMJ)

English | [한국어](README.ko.md)

[![CI](https://github.com/S-jooyoung/oh-my-joy/actions/workflows/ci.yml/badge.svg)](https://github.com/S-jooyoung/oh-my-joy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20deps-0-brightgreen.svg)](package.json)

> One frontend plugin that stitches the whole code ↔ Figma loop together.

**Every frontend task starts with `/omj` — draft the spec, verify it, sync the tokens.**
_A Plan-native primer that doesn't fight your "almost always in Plan mode" habit._

`Plan-first` · `Figma 2-track` · `interactive token sync` · `graceful degradation` · `conflict-free alongside OMC/OMX`

[Why](#why) • [Quick Start](#quick-start) • [Commands](#commands) • [Design notes](#what-this-repo-demonstrates) • [OMJ × OMC/OMX](#omj--omcomx) • [Troubleshooting](#troubleshooting)

---

## Why

Handing a Figma frame to an AI agent and asking it to "build this" fails in a specific, repeatable way: the output looks close, but tokens get inlined as raw hex, responsive branches get invented, and a11y is whatever the model felt like that day. The defect is never the same twice, so you catch it in review instead of preventing it.

The obvious fix — one command that reads Figma and writes the code — collides with how Claude Code actually works. **Plan mode blocks `Write`/`Edit` by design**, and that is the mode many of us live in. (Read-only Bash such as `git diff` still runs; whether side-effecting Bash and MCP write tools are blocked depends on your environment.) A one-shot implement command would half-work exactly where it is invoked most.

So OMJ inverts it. `/omj` is **not** an implement command — it is a read-only primer that turns the tool's constraint into the design axis: it reads the design, drafts an implementation spec scored against fixed quality criteria, and **stops**. That spec *is* the native Plan you approve. Plan mode's write block stops being an obstacle and becomes the review gate.

```mermaid
flowchart TD
    A["/omj<br/>Figma + code → spec"]:::readonly --> B["implementation spec<br/>uSpec sections × FF criteria × a11y"]:::readonly
    B --> C{{"ExitPlanMode<br/>you review and approve"}}
    C --> D["execution lane<br/>inline · /goal · /team · /ralph"]
    D --> E["/omj-review<br/>code diff vs criteria"]:::readonly
    D --> F["/omj-verify<br/>rendered route vs baseline"]
    F -->|defects found| G["/omj-fix<br/>edit → re-capture"]
    G --> F
    D --> H["/omj-sync<br/>tokens ↔ Figma, you pick the direction"]

    classDef readonly stroke:#888,stroke-width:2px,stroke-dasharray: 5 5;
```

_Dashed = read-only, no source side effects. Nothing crosses the approval gate without you._

---

## What this repo demonstrates

Each claim below is checkable in this repo — the artifact is named, and so is the alternative that was rejected.

- **Least privilege is declared in the manifest, not left to convention.** `/omj` ships with `allowed-tools: Read, Grep, Glob, Skill, AskUserQuestion` plus read-only Figma/Context7 MCP ([`commands/omj.md`](commands/omj.md)). No write tool is pre-approved, so a write attempt cannot happen silently — it surfaces as an explicit permission prompt, and in Plan mode `Write`/`Edit` are blocked outright. Rejected: "grant the tools and instruct the model not to use them" — prose is not an enforcement layer, which is exactly the bug fixed in [`commands/omj-start.md`](commands/omj-start.md), where a `Bash(...)` wildcard was quietly pre-approving every argument its prose forbade.
- **One source of truth per fact, and the doc facts are CI-checked.** Execution-lane thresholds live only in [`docs/EXECUTION-HANDOFF.md`](docs/EXECUTION-HANDOFF.md); commands link to it and carry at most a threshold-free fallback for when that file is unreachable. A dependency-free suite checks that the two READMEs declare the same command set and installation string, that no Korean leaks into the English page, that every relative link resolves, and that each CHANGELOG release link points at the right compare range ([`tests/docs-consistency.test.mjs`](tests/docs-consistency.test.mjs)). Rejected: restating the lane rules wherever they were needed — the pre-0.3.0 copies in `commands/omj.md` and `docs/OMC-INTEGRATION.md` drifted within one release.
- **Every dependency is optional, by design.** Figma MCP, playwright, Context7, OMC/OMX — each absence degrades to "skip + explain", never an error, so the plugin is useful on day one in any environment. Rejected: hard requirements, which turn a plugin into a setup project.
- **The plugin never fires hooks on its own.** Shipping `hooks/hooks.json` would make every repo with the plugin enabled run these checks; instead the scripts are templates that `/omj-setup` copies into a project that opts in, and they no-op without an explicit declaration. This invariant is pinned by a test, not a comment ([`tests/plugin-manifest.test.mjs`](tests/plugin-manifest.test.mjs)).
- **Behaviour is tested even though it is written in Markdown.** The two hook scripts are exercised as real subprocesses against the PostToolUse contract, including the false-positive cases that made an earlier version report noise instead of signal ([`tests/hooks/`](tests/hooks)).

The reasoning behind each decision — problem → decision → rationale → outcome, plus the alternatives that were rejected and why — is in [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md) (Korean), summarized as an eleven-row decision table in [`docs/PRINCIPLES.en.md`](docs/PRINCIPLES.en.md) (English).

---

## Quick Start

```
# 1. Install (enter one line at a time)
/plugin marketplace add S-jooyoung/oh-my-joy
/plugin install oh-my-joy@omj

# 2. Check dependencies (recommended before first use)
/omj-setup

# 3. Start — turn intent into an implementation spec (Plan), choose execution lane, then stop → approve → implement
/omj "Search input form — React Hook Form + Zod, mobile-first" /search
```

> `/omj` is a read-only primer — it never writes code directly; it drafts a spec, recommends an execution lane by marking option 1 with the literal label `(추천)` ("recommended"), and stops. Not sure where to start? Run `/omj-setup` first.

---

## Commands

| Command | What it does | When to use | Example |
| --- | --- | --- | --- |
| **`/omj`** | Gather specs + author an implementation spec (Plan) + recommend one execution lane, then stop (read-only primer). Infers the verify route when omitted; supports multiple Figma nodes mixed with text tasks | The starting point for every FE task | `/omj https://figma.com/design/abc?node-id=1-2 /settings/profile` |
| **`/omj-start`** | Handoff an approved OMJ spec to the selected OMC/OMX execution lane | After approving a spec when auto-start is unavailable (not needed for `(auto)` inline specs) | `/omj-start ./omj-search-spec.md` |
| **`/omj-review`** | Review the changed FE diff against FF 4-criteria + a11y · Figma fidelity · vercel · Next.js (report only) | Right after implementing, before a PR | `/omj-review --base main` |
| **`/omj-verify`** | Open a route in a real browser (playwright-cli, falls back to playwright MCP) and check visuals/structure against the Figma baseline (`.omj/baselines/`); always asserts the captured page actually reached the requested route (auth redirects are reported as failures, never compared) | Visual-regression check before a PR | `/omj-verify /settings/profile` |
| **`/omj-fix`** | Fix defects from a pasted screenshot + route, then re-capture to confirm (active loop) | Quick fixes for pixel/visual defects | `/omj-fix /pricing "banner z-index too low"` |
| **`/omj-sync`** | Reconcile drift between the token store (`tokens.json` **or CSS custom properties**) ↔ Figma by **asking you the direction**; `extract` bootstraps CSS tokens from Figma variables | Aligning code/Figma tokens · first extraction | `/omj-sync` · `check` · `push` · `extract <figma-url>` |
| **`/omj-setup`** | Dependency doctor + batch multi-select install + scaffolding for `.omj/fe-context.md` (adopts existing rule docs like `AGENTS.md`/`.claude/rules/` via `contextDocs:` instead of duplicating them) and opt-in token-guard hooks (the Story hook is offered only when Storybook is detected); optionally offers a GitHub star at the end (skipped silently if already starred, never blocks setup) | Before first use — `/omj` also suggests it once when no setup trace exists | `/omj-setup` |

> **read-only vs active op.** `/omj` and `/omj-review` are read-only (report only) — `/omj` may ask **at most one** post-spec execution-lane question (skipped with an `(auto)` record when inline/manual is recommended — Plan approval doubles as lane consent), and still cannot Write/Edit/build/test. `/omj-start` is a handoff command: it launches only when the runtime surface is explicit and safe, otherwise it prints one copyable action. `/omj-verify`, `/omj-fix`, and `/omj-sync` (sync/push/extract) are active ops using Figma write / `Edit`/`Write` / Bash; if your environment blocks those in Plan mode, exit Plan mode first. Each command's syntax, arguments, and steps live in its `commands/<name>.md` (the source of truth).
>
> **Auto-trigger.** The command descriptions are written to match the two most frequent real-world patterns, so the agent can route to them without you typing the slash command: pasting a Figma Dev Mode link ("implement this design…") routes to `/omj`, and pasting a screenshot with a visual complaint ("misaligned", "clipped", "wrong spacing/color") routes to `/omj-fix`.

### Bundled agents & opt-in hooks (v0.3.0)

- **`figma-implementer`** (agent) — implements an **approved OMJ spec** through a 5-step loop (Clarify→Context→Plan→Generate→Evaluate) as the inline-lane executor. Refuses bare Figma URLs without a spec and points to `/omj` first (no plan-gate bypass). Selected OMC/OMX lanes always take precedence.
- **`design-qa`** (agent) — a mechanical gate that only **checks** (never edits): typecheck, lint, hardcoded tokens, Figma fidelity, a11y basics, plus Story/i18n checks only when declared in fe-context.
- **Token-guard hooks** — `check-design-tokens.mjs` (hardcoded-color warning) and `check-story-exists.mjs` (missing-Story warning) in `templates/hooks/`. **The plugin never fires them by itself** — they run only after `/omj-setup` copies and registers them into a consuming project's `.claude/hooks/` (opt-in), and they no-op without an `.omj/fe-context.md` declaration.

### `/omj-sync` — you choose the direction

`/omj-sync` does not force "code always wins." **Code is the default source of truth**, but when drift exists it groups conflicts by class (value-mismatch / code-only / Figma-only) and asks the direction via `AskUserQuestion`. The first option of each question follows code authority — `code→Figma` for value-mismatch and code-only, and a conservative `skip` for Figma-only — so pressing enter stays safe.

- `/omj-sync` (default `sync`) — interactive reconcile, asks the direction.
- `/omj-sync check` — read-only drift report + a "suggested token code" block for Figma-only tokens.
- `/omj-sync push` — apply code→Figma in bulk with no prompts (explicit code-wins).
- `/omj-sync extract <figma-url>` — extract all Figma variables into CSS custom properties (`/`→`-` naming, primitive→semantic `var()` references preserved, mapping table in `docs/design-tokens.md`). Bootstraps projects with no token store yet.

> Both store formats are supported: `tokens.json` (DTCG) and CSS custom properties (`*.css`). Figma variable access requires **edit permission** — duplicate viewer-shared files first.

---

## Dependencies (all optional · graceful degradation)

Missing ones never crash — OMJ **skips + guides** instead.

| Dependency | Used by | When absent |
| --- | --- | --- |
| Official Figma Dev Mode MCP | `/omj` (read design), `/omj-sync` (read/write Variables) | "Figma not connected — proceed with a manual spec", then continue |
| `playwright-cli` **or** playwright MCP | `/omj-verify` · `/omj-fix` (cli first, MCP fallback) | with neither: "no capture backend — skipping verify", then exit |
| Context7 | `/omj` · `/omj-review` · `/omj-fix` (fetch latest Next.js docs) | that step is skipped |

> Figma writes (`/omj-sync` push/pull, reading a design) require the **Figma desktop app running with the target file as the active tab**. MCP tool names vary by environment — check `/mcp`.

---

## OMJ × OMC/OMX

OMJ is a **standalone plugin independent of** oh-my-claudecode (OMC) and oh-my-codex (OMX). Installing them together never conflicts (`/omj*` stays OMJ-owned).

- **Mental model (one sentence)**: "Start every FE task with `/omj` — approve the spec, then take option 1 (labeled `(추천)`, i.e. the recommended lane) unless you intentionally choose another OMC/OMX execution lane."

| Stage | OMJ | OMC/OMX |
| --- | --- | --- |
| Plan | `/omj` (FE spec, native Plan + execution selector) | `/oh-my-claudecode:plan` · `/ralplan` · `$ralplan` (OMX: plan-only) |
| Execute | `/omj-start` fallback handoff | `/goal` · `$ultragoal` · `/team`/`$team` · `/ralph`/`$ralph` |
| Verify | `/omj-review` · `/omj-verify` | `/verify` · `$ultraqa` |

The implementation spec `/omj` produces is exactly the input OMC/OMX execution tools consume. The routing source of truth is **[docs/EXECUTION-HANDOFF.md](docs/EXECUTION-HANDOFF.md)** (Korean); see **[docs/OMC-INTEGRATION.md](docs/OMC-INTEGRATION.md)** (Korean) for A/B/C flows, gate rules, and handoff constraints.

---

## Principles · Figma 2-track

- **Plan-native primer**: `/omj` is read-only — it drafts a spec, asks at most one execution-lane selector (skipped with `(auto)` when inline/manual is recommended), and stops; implementation starts only after you approve (ExitPlanMode).
- **Spec format**: uSpec sections (Anatomy / Structure / Color·Tokens / Props·Variants / A11y / Motion) + FF 4-criteria + a11y + Figma fidelity (`figma-fidelity.md`) per item.
- **Token sync**: code is the default SoT, and you choose the direction on conflict (interactive). Both DTCG json and CSS custom-property stores.
- **Figma 2-track**: (A) app-screen design→code = official Dev Mode MCP; (B) design-system spec/tokens = figma-console-mcp + uSpec (v1.1+).
- **Minimal bundle**: externally-maintained knowledge is referenced only (vercel skills — `npx skills add/update`); OMJ bundles only what it owns (FF skill, 2 agents, hook templates). The plugin itself stays zero-hook — hooks fire only via opt-in copy-install.

The "why" behind each decision lives in **[docs/PRINCIPLES.md](docs/PRINCIPLES.md)** (Korean).

---

## Troubleshooting

- **`/omj` didn't change any code** — that's correct. It's a read-only primer: it drafts a spec, records the selected execution lane, and stops. Implementation starts after you approve (ExitPlanMode); if auto-start is unavailable, run the one `/omj-start <approved-spec>` action it prints.
- **`/omj-verify` / `/omj-fix` does nothing** — no capture backend (neither playwright-cli nor playwright MCP), dev server not running (`yarn dev`), an auth-gated route, or your environment's Plan mode blocked Bash. For auth routes, declare `verifySetup` in `.omj/fe-context.md` (recommended) or `export JOY_TEST_EMAIL=… JOY_TEST_PASSWORD=…` before running — **use a test-only account**, and gitignore `.omj/baselines/` since post-login screenshots can contain session data or PII.
- **Figma not connected / no permission** — `This figma file could not be accessed` is handled gracefully. Open the Figma desktop app, put the target file in the active tab, and retry. **Variable/node access requires edit permission** — duplicate viewer-shared files (tutorials etc.) and use the copy's URL.
- **Baseline comparison not happening** — Figma asset URLs expire after ~7 days; re-run `/omj` to refresh the spec's baseline provenance. Cross-session comparison relies on the PNGs in `.omj/baselines/` (gitignore recommended). Note the PNG is **first created** only when `/omj-verify` runs in the same session as `/omj` (a fully separate session has no URL source — spec-based re-lookup is planned for v1.1).
- **MCP tool names differ** — Figma/Context7 tool names vary by environment. Check the actual names with `/mcp`.
- **Duplicate committed skill copy** — if a project committed `frontend-fundamentals` into its own `.claude/skills/`, it may load alongside the OMJ bundle (harmless). Don't delete that copy (deleting it breaks teammates who cloned without OMJ installed) — just edit the source of truth in one place.
