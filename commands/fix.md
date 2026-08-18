---
description: Paste a screenshot and describe a visual/behavioral defect — "misaligned/clipped/odd spacing·color·hover/awkward line breaks" ("정렬이 안 맞아", "잘려 보여") — and this command fixes the route's defect and confirms with a recapture, as an active loop (observation/recheck reuses the /oh-my-joy:verify capture protocol)
argument-hint: "<route> [\"complaint/description\"] [--base <url>] [--commit]"
allowed-tools: Read, Grep, Glob, Edit, Skill, Bash(command -v:*), Bash(playwright-cli:*), Bash(curl:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(npx tsc:*), mcp__playwright__*, mcp__plugin_playwright_playwright__*, mcp__plugin_context7-plugin_context7__*, mcp__context7__*
---

# /oh-my-joy:fix — Visual/behavioral defect fix loop

Diagnoses the defect in the pasted **screenshot + route**, **fixes it, then confirms with a recapture**.
This is an **active op**, unlike `/oh-my-joy:spec` (the read-only primer). The flow is **observe (same capture as `/oh-my-joy:verify`) → Edit (fix) → recheck (same capture)** — a thin composition that runs the capture procedure inline rather than invoking `/oh-my-joy:verify`.

> ⚠️ **Run outside Plan mode.** It uses Edit·Bash, so Plan mode blocks it (same as the active ops `/oh-my-joy:verify`·`/oh-my-joy:sync push`).
> For large/ambiguous changes, pull a spec first with the `/oh-my-joy:spec` primer.

## SoT note — never redefine the capture protocol

The **capture procedure for observation and recheck is identical to `/oh-my-joy:verify`** — the `-s=omj` session, `open --persistent`/`goto`/`snapshot`/`screenshot`,
login-redirect re-login (`$JOY_TEST_EMAIL`/`$JOY_TEST_PASSWORD`), `--base`/`${JOY_BASE_URL:-http://localhost:3000}`,
`command -v playwright-cli`·`curl -sf "$BASE"` preflight. **The canon for this procedure is `commands/verify.md` and it is not restated here** (this is inline execution, not a `/oh-my-joy:verify` invocation).
The only difference is **session lifetime** — `/oh-my-joy:verify` runs `close` at the end of every invocation, whereas `/oh-my-joy:fix` spans observe→fix→recheck in a **single `-s=omj` session** and runs `close` **once, in step 5**. The **only genuinely new part of this command is the fix (+ optional commit) between observation and recheck**.

## Procedure

1. **Arguments**
   - `<route>` (required) — the path with the defect (e.g. `/pricing`, `/products/42`). If missing, print usage and stop.
   - `["complaint/description"]` (optional) — what is wrong. If empty **and no screenshot was pasted**, announce "nothing to fix identified" and stop.
   - `--base <url>` — base URL override (default `http://localhost:3000`; for Vite etc. use `--base http://localhost:5173`).
   - `--commit` — commit when verification passes (default: no commit).
   - If a **screenshot was pasted** into the conversation, first interpret in one line whether it shows *the current defective screen* or *the expected design*, then use it as the reference for step 3's comparison.

2. **Observe** — view the current screen via the `/oh-my-joy:verify` capture protocol (preflight → `open --persistent`/`goto`/`snapshot`/`screenshot`). On preflight failure (playwright-cli missing, server down), exit gracefully (no auto-start). **Do not `close` at this step** — the session is cleaned up only in step 5.

3. **Diagnose** — invoke `frontend-fundamentals` via `Skill`. Compare the pasted screenshot/complaint against the current capture, and **proactively check the universal FF criteria + any project acceptance axes declared in the repo's `.omj/fe-context.md`** (before the user points them out). If `.omj/baselines/<route-slug>@<viewport>.png` exists (key rules and comparison procedure canon: `verify.md`), `Read` it into the comparison too; if fe-context declares `verifySetup`, apply that procedure before observing. Locate the relevant components/hooks/styles with `Glob`·`Grep`·`Read`. For Next.js version-sensitive topics, consult Context7 (skip if absent, graceful).

4. **Fix** — `Edit` only the defect with the **minimal change** (token deviation → semantic token, arbitrary px → ratio/token). Run the typecheck in the background (`run_in_background: true`, matching the repo: `npx tsc --noEmit` or `apps/*/tsconfig.json`). Confirm exit 0; on failure, iterate immediately.

5. **Recheck** — recapture via the `/oh-my-joy:verify` capture protocol to confirm the defect is resolved, then clean up the session with `close`. If the defect remains, repeat steps 3–5 (at most twice); if it still remains, report the residual defect and stop.

6. **(only with --commit) Commit** — follow the host project's existing commit message conventions (including language). **No AI signatures / `Co-Authored-By`.** Never bypass pre-commit hooks (`--no-verify`).
   - **Hard staging-scope rule**: before committing, check the working tree and changes with `git status`·`git diff`, then explicitly stage only the files `Edit`ed in step 4 via `git add <path> …`. `git add -A`·`git add .` are forbidden — never commit working-tree changes this command did not make.
   - If invoked without `--commit`, do not run `git add`/`git commit` at all (permission declarations are per-command, so the body enforces the flag).

## Output

Group the fixes by severity (🔴 blocker / 🟡 major / 🟢 minor·nit): `file:line + what was wrong + fix applied + recapture confirmation`.

## Usage

```
/oh-my-joy:fix /pricing "[screenshot] banner z-index too low, text overlaps it"
/oh-my-joy:fix /products/42 "card alignment off" --commit
/oh-my-joy:fix / --base http://localhost:5173 "hero color bleeds outside the radius"
```

> If `/oh-my-joy:verify` (inspection) found something to fix, continue with `/oh-my-joy:fix`. To only look without fixing, use `/oh-my-joy:verify`; for a code-quality report only, use `/oh-my-joy:ff-review`.
