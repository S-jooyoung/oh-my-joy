# oh-my-joy (OMJ)

English | [한국어](README.ko.md)

> One frontend plugin that stitches the whole code ↔ Figma loop together.

**Every frontend task starts with `/omj` — draft the spec, verify it, sync the tokens.**
_A Plan-native primer that doesn't fight your "almost always in Plan mode" habit._

`Plan-first` · `Figma 2-track` · `interactive token sync` · `graceful degradation` · `conflict-free alongside OMC`

[Quick Start](#quick-start) • [Commands](#commands) • [OMJ × OMC](#omj--omc) • [Principles](#principles--figma-2-track) • [Troubleshooting](#troubleshooting)

---

## Quick Start

```
# 1. Install (enter one line at a time)
/plugin marketplace add ~/projects/oh-my-joy
/plugin install oh-my-joy@omj

# 2. Check dependencies (recommended before first use)
/omj-setup

# 3. Start — turn intent into an implementation spec (Plan), then stop → review & approve (ExitPlanMode) → implement
/omj "Search input form — React Hook Form + Zod, mobile-first" /search
```

> `/omj` is a read-only primer — it never writes code directly; it drafts a spec and stops. Not sure where to start? Run `/omj-setup` first.

---

## Commands

| Command | What it does | When to use | Example |
| --- | --- | --- | --- |
| **`/omj`** | Gather specs + author an implementation spec (Plan), then stop (read-only primer) | The starting point for every FE task | `/omj https://figma.com/design/abc?node-id=1-2 /settings/profile` |
| **`/omj-review`** | Review the changed FE diff against FF 4-criteria + a11y · vercel · Next.js (report only) | Right after implementing, before a PR | `/omj-review --base main` |
| **`/omj-verify`** | Open a route in a real browser (playwright-cli) and check visuals/structure | Visual-regression check before a PR | `/omj-verify /settings/profile` |
| **`/omj-fix`** | Fix defects from a pasted screenshot + route, then re-capture to confirm (active loop) | Quick fixes for pixel/visual defects | `/omj-fix /pricing "banner z-index too low"` |
| **`/omj-sync`** | Reconcile token drift (`tokens.json` ↔ Figma) by **asking you the direction** (interactive) | Aligning code/Figma tokens | `/omj-sync` · `/omj-sync check` · `/omj-sync push` |
| **`/omj-setup`** | Dependency doctor + install guide | Before first use | `/omj-setup` |

> **read-only vs active op.** `/omj` and `/omj-review` are read-only (report only) — `/omj-review` only runs `git diff`, so it generally works even in Plan mode. `/omj-verify`, `/omj-fix`, and `/omj-sync` (sync/push) are active ops using Figma write / `Edit` / Bash; if your environment blocks those in Plan mode, exit Plan mode first. Each command's syntax, arguments, and steps live in its `commands/<name>.md` (the source of truth).

### `/omj-sync` — you choose the direction

`/omj-sync` does not force "code always wins." **Code is the default source of truth**, but when drift exists it groups conflicts by class (value-mismatch / code-only / Figma-only) and asks the direction via `AskUserQuestion`. The first option of each question follows code authority — `code→Figma` for value-mismatch and code-only, and a conservative `skip` for Figma-only — so pressing enter stays safe.

- `/omj-sync` (default `sync`) — interactive reconcile, asks the direction.
- `/omj-sync check` — read-only drift report.
- `/omj-sync push` — apply code→Figma in bulk with no prompts (explicit code-wins).

---

## Dependencies (all optional · graceful degradation)

Missing ones never crash — OMJ **skips + guides** instead.

| Dependency | Used by | When absent |
| --- | --- | --- |
| Official Figma Dev Mode MCP | `/omj` (read design), `/omj-sync` (read/write Variables) | "Figma not connected — proceed with a manual spec", then continue |
| `playwright-cli` | `/omj-verify` · `/omj-fix` | "not installed — skipping verify/fix", then exit |
| Context7 | `/omj` · `/omj-review` · `/omj-fix` (fetch latest Next.js docs) | that step is skipped |

> Figma writes (`/omj-sync` push/pull, reading a design) require the **Figma desktop app running with the target file as the active tab**. MCP tool names vary by environment — check `/mcp`.

---

## OMJ × OMC

OMJ is a **standalone plugin independent of** oh-my-claudecode (OMC). Installing both never conflicts (`/omj*` vs `/omc-*`).

- **Mental model (one sentence)**: "Start every FE task with `/omj` — escalate to OMC `executor` after approval when it grows. Go straight to OMC only for backend / general / research."

| Stage | OMJ | OMC |
| --- | --- | --- |
| Plan | `/omj` (FE spec, native Plan) | `/omc-plan` · `/ralplan` |
| Execute | — | `/ralph` · `/team` · `/goal` |
| Verify | `/omj-review` · `/omj-verify` | `/verify` (BE/general) |

The implementation spec `/omj` produces is exactly the input OMC's execution tools consume. See **[docs/OMC-INTEGRATION.md](docs/OMC-INTEGRATION.md)** (Korean) for the A/B/C flows, gate rules, and handoff constraints.

---

## Principles · Figma 2-track

- **Plan-native primer**: `/omj` is read-only — it drafts a spec and stops; implementation starts only after you approve (ExitPlanMode).
- **Spec format**: uSpec sections (Anatomy / Structure / Color·Tokens / Props·Variants / A11y / Motion) + FF 4-criteria + a11y per item.
- **Token sync**: code is the default SoT, and you choose the direction on conflict (interactive).
- **Figma 2-track**: (A) app-screen design→code = official Dev Mode MCP; (B) design-system spec/tokens = figma-console-mcp + uSpec (v1.1+).
- **Minimal bundle**: only the in-house `frontend-fundamentals` skill is bundled; vercel skills are referenced (`npx skills add/update`).

The "why" behind each decision lives in **[docs/PRINCIPLES.md](docs/PRINCIPLES.md)** (Korean).

---

## Troubleshooting

- **`/omj` didn't change any code** — that's correct. It's a read-only primer: it only drafts a spec and stops. Implementation starts after you approve (ExitPlanMode).
- **`/omj-verify` / `/omj-fix` does nothing** — `playwright-cli` not installed, dev server not running (`yarn dev`), an auth-gated route (needs credential env), or your environment's Plan mode blocked Bash. For auth routes, `export JOY_TEST_EMAIL=… JOY_TEST_PASSWORD=…` before running.
- **Figma not connected / no permission** — `This figma file could not be accessed` is handled gracefully. Open the Figma desktop app, put the target file in the active tab, and retry.
- **MCP tool names differ** — Figma/Context7 tool names vary by environment. Check the actual names with `/mcp`.
- **Duplicate committed skill copy** — if a project committed `frontend-fundamentals` into its own `.claude/skills/`, it may load alongside the OMJ bundle (harmless). Don't delete that copy (deleting it breaks teammates who cloned without OMJ installed) — just edit the source of truth in one place.
