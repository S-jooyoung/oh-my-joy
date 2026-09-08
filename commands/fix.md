---
description: Paste a screenshot and describe a visual/behavioral defect — "misaligned/clipped/odd spacing·color·hover/awkward line breaks" ("정렬이 안 맞아", "잘려 보여") — and this command fixes the route's defect and confirms with a recapture, as an active loop (observation/recheck reuses the /oh-my-joy:verify capture protocol)
argument-hint: "<route> [\"complaint/description\"] [--base <url>] [--commit]"
allowed-tools: Read, Grep, Glob, Edit, Skill, Bash(command -v:*), Bash(playwright-cli:*), Bash(curl:*), Bash(git status:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git checkout -b:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(npx tsc:*), mcp__playwright__*, mcp__plugin_playwright_playwright__*, mcp__plugin_context7-plugin_context7__*, mcp__context7__*
---

# /oh-my-joy:fix — Visual defect fix loop

Diagnose the defect in a pasted screenshot plus a route, fix it, and confirm with a recapture. The flow is observe → edit → recheck, a thin composition around the same capture procedure `/oh-my-joy:verify` uses, run inline rather than by invoking that command.

This is an active op: it uses `Edit` and side-effect Bash, so Plan mode blocks it — run it outside Plan mode. For large or ambiguous changes, create an approved plan first with `/oh-my-joy:ralplan`; this loop is for defects that a screenshot and one sentence already scope.

## Capture procedure — canonical in verify.md

Observation and recheck use exactly the procedure in `commands/verify.md` browser mode: the `-s=omj` session, `open --persistent`/`goto`/`snapshot`/`screenshot`, login-redirect re-login with `$JOY_TEST_EMAIL`/`$JOY_TEST_PASSWORD`, `--base` with `${JOY_BASE_URL:-http://localhost:3000}`, and the `command -v playwright-cli` and `curl -sf "$BASE"` preflight. It is not restated here so the two commands cannot drift apart. The one difference is session lifetime: verify closes its session every run, while fix keeps one session across observe → fix → recheck and closes it once in step 5.

## Procedure

1. Arguments.
   - `<route>` (required) — the path with the defect, for example `/pricing`. Missing → print Usage and stop.
   - `["complaint/description"]` — what is wrong. With no description and no pasted screenshot, say "nothing to fix identified" and stop.
   - `--base <url>` — dev server override (default `http://localhost:3000`).
   - `--commit` — commit when the recheck passes (default: no commit).
   - When a screenshot was pasted, first state in one line whether it shows the current defective screen or the expected design; that reading is the reference for step 3.
2. Observe — capture the current screen via the verify procedure (preflight, then `open --persistent`/`goto`/`snapshot`/`screenshot`). A preflight failure (no capture backend, server down) exits with guidance; nothing is auto-started. Do not close the session here.
3. Diagnose — invoke `frontend-fundamentals` via `Skill`. Compare the pasted screenshot or complaint with the capture, and check the universal criteria plus any acceptance axes the repo declares in `.omj/fe-context.md` before the user points them out. If `.omj/baselines/<route-slug>@<viewport>.png` exists, `Read` it into the comparison (key rules in `verify.md`); if fe-context declares `verifySetup`, apply it before observing. Locate the relevant components, hooks, and styles with `Glob`/`Grep`/`Read`. Consult Context7 for Next.js version-sensitive topics; skip when absent.
4. Fix — `Edit` only the defect, with the minimal change (a token deviation becomes a semantic token, an arbitrary px becomes a ratio or token). Run the typecheck in the background (`npx tsc --noEmit`, or the repo's own script) and confirm exit 0; on failure, iterate immediately.
5. Recheck — recapture via the verify procedure to confirm the defect is gone, then `close` the session. If it remains, repeat steps 3–5 at most twice more, then report the residual defect and stop.
6. Commit (only with `--commit`) — after the recheck passes and every applicable check exits 0, follow the host project's commit conventions, including language. No AI signatures or `Co-Authored-By` trailers, and no `--no-verify`. Check the tree with `git status` and `git diff`, inspect recent commits with `git log`, and resolve the current branch with `git rev-parse --abbrev-ref HEAD` plus the repository's default/shared branches with `git branch -a`. If the current branch is shared (`main`, `master`, `develop`, `dev`, `trunk`, `staging`, `release/*`, or the remote default), first create a uniquely named `fix/<short-slug>` branch. Stage only the files edited in step 4 by explicit path with `git add <path> …` — never `git add -A` or `git add .`, which would commit unrelated working-tree changes — then run `git commit` and record the resulting hash. Fix never pushes. Without `--commit`, run no `git checkout -b`, `git add`, or `git commit` at all.

## Output

Group the fixes by severity (🔴 blocker / 🟡 major / 🟢 minor): `file:line + what was wrong + the fix applied + recapture confirmation`. Include each verification command and exit code. With `--commit`, also report the branch and actual commit hash.

## Usage

<example>
```
/oh-my-joy:fix /pricing "[screenshot] banner z-index too low, text overlaps it"
/oh-my-joy:fix /products/42 "card alignment off" --commit
/oh-my-joy:fix / --base http://localhost:5173 "hero color bleeds outside the radius"
```
</example>

If `/oh-my-joy:verify` found the defect, continue here. To only look, use `/oh-my-joy:verify`; for a code-quality report, `/oh-my-joy:review`.
