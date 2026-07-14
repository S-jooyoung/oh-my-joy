# oh-my-joy (OMJ)

English | [한국어](README.ko.md)

> One frontend plugin that stitches the whole code ↔ Figma loop together.

**Every frontend task starts with `/omj` — draft the spec, verify it, sync the tokens.**
_A Plan-native primer that doesn't fight your "almost always in Plan mode" habit._

`Plan-first` · `Figma 2-track` · `interactive token sync` · `graceful degradation` · `conflict-free alongside OMC/OMX`

[Quick Start](#quick-start) • [Commands](#commands) • [OMJ × OMC/OMX](#omj--omcomx) • [Principles](#principles--figma-2-track) • [Troubleshooting](#troubleshooting)

---

## Quick Start

```
# 1. Install (enter one line at a time)
/plugin marketplace add ~/projects/oh-my-joy
/plugin install oh-my-joy@omj

# 2. Check dependencies (recommended before first use)
/omj-setup

# 3. Start — turn intent into an implementation spec (Plan), choose execution lane, then stop → approve → implement
/omj "Search input form — React Hook Form + Zod, mobile-first" /search
```

> `/omj` is a read-only primer — it never writes code directly; it drafts a spec, recommends an execution lane with option 1 marked `(추천)`, and stops. Not sure where to start? Run `/omj-setup` first.

---

## Commands

| Command | What it does | When to use | Example |
| --- | --- | --- | --- |
| **`/omj`** | Gather specs + author an implementation spec (Plan) + recommend one execution lane, then stop (read-only primer). Infers the verify route when omitted; supports multiple Figma nodes mixed with text tasks | The starting point for every FE task | `/omj https://figma.com/design/abc?node-id=1-2 /settings/profile` |
| **`/omj-start`** | Handoff an approved OMJ spec to the selected OMC/OMX execution lane | After approving a spec when auto-start is unavailable (not needed for `(auto)` inline specs) | `/omj-start ./omj-search-spec.md` |
| **`/omj-review`** | Review the changed FE diff against FF 4-criteria + a11y · Figma fidelity · vercel · Next.js (report only) | Right after implementing, before a PR | `/omj-review --base main` |
| **`/omj-verify`** | Open a route in a real browser (playwright-cli, falls back to playwright MCP) and check visuals/structure against the Figma baseline (`.omj/baselines/`) | Visual-regression check before a PR | `/omj-verify /settings/profile` |
| **`/omj-fix`** | Fix defects from a pasted screenshot + route, then re-capture to confirm (active loop) | Quick fixes for pixel/visual defects | `/omj-fix /pricing "banner z-index too low"` |
| **`/omj-sync`** | Reconcile drift between the token store (`tokens.json` **or CSS custom properties**) ↔ Figma by **asking you the direction**; `extract` bootstraps CSS tokens from Figma variables | Aligning code/Figma tokens · first extraction | `/omj-sync` · `check` · `push` · `extract <figma-url>` |
| **`/omj-setup`** | Dependency doctor + install guide + scaffolding for `.omj/fe-context.md` and opt-in token-guard hooks | Before first use | `/omj-setup` |

> **read-only vs active op.** `/omj` and `/omj-review` are read-only (report only) — `/omj` may ask **at most one** post-spec execution-lane question (skipped with an `(auto)` record when inline/manual is recommended — Plan approval doubles as lane consent), and still cannot Write/Edit/build/test. `/omj-start` is a handoff command: it launches only when the runtime surface is explicit and safe, otherwise it prints one copyable action. `/omj-verify`, `/omj-fix`, and `/omj-sync` (sync/push/extract) are active ops using Figma write / `Edit`/`Write` / Bash; if your environment blocks those in Plan mode, exit Plan mode first. Each command's syntax, arguments, and steps live in its `commands/<name>.md` (the source of truth).

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

- **Mental model (one sentence)**: "Start every FE task with `/omj` — approve the spec, then take option 1 `(추천)` unless you intentionally choose another OMC/OMX execution lane."

| Stage | OMJ | OMC/OMX |
| --- | --- | --- |
| Plan | `/omj` (FE spec, native Plan + execution selector) | `/omc-plan` · `/ralplan` · `$ralplan` |
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
- **`/omj-verify` / `/omj-fix` does nothing** — no capture backend (neither playwright-cli nor playwright MCP), dev server not running (`yarn dev`), an auth-gated route, or your environment's Plan mode blocked Bash. For auth routes, declare `verifySetup` in `.omj/fe-context.md` (recommended) or `export JOY_TEST_EMAIL=… JOY_TEST_PASSWORD=…` before running.
- **Figma not connected / no permission** — `This figma file could not be accessed` is handled gracefully. Open the Figma desktop app, put the target file in the active tab, and retry. **Variable/node access requires edit permission** — duplicate viewer-shared files (tutorials etc.) and use the copy's URL.
- **Baseline comparison not happening** — Figma asset URLs expire after ~7 days; re-run `/omj` to refresh the spec's baseline provenance. Cross-session comparison relies on the PNGs in `.omj/baselines/` (gitignore recommended). Note the PNG is **first created** only when `/omj-verify` runs in the same session as `/omj` (a fully separate session has no URL source — spec-based re-lookup is planned for v1.1).
- **MCP tool names differ** — Figma/Context7 tool names vary by environment. Check the actual names with `/mcp`.
- **Duplicate committed skill copy** — if a project committed `frontend-fundamentals` into its own `.claude/skills/`, it may load alongside the OMJ bundle (harmless). Don't delete that copy (deleting it breaks teammates who cloned without OMJ installed) — just edit the source of truth in one place.
