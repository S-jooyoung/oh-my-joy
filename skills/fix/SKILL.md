---
name: fix
description: Diagnose and repair a scoped frontend visual or behavioral defect from a route, screenshot, or concrete complaint, then recapture the result. Use for explicit fix requests; use verify for report-only inspection.
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Fix a frontend defect

Run an observe -> edit -> recheck loop for a defect that is already scoped by a route plus a screenshot or concise complaint. This skill changes code. If the expected behavior is still ambiguous or the change is broad, produce a spec instead.

## Inputs

- Require a route. Accept an optional base URL, defaulting to `${JOY_BASE_URL:-http://localhost:3000}`.
- Require either an attached screenshot or a concrete defect description. If neither exists, report that no defect was identified and stop.
- Treat an attached screenshot as either the defective current state or the expected design; state which interpretation the request supports before editing.
- Commit only when the user explicitly requests it. A fix request alone does not authorize a commit.

## Observe

1. Read `.omj/fe-context.md` when present. Follow `verifySetup`, project acceptance axes, `contextDocs`, and declared verification commands that apply to the defect.
2. Confirm a capture backend is available. Prefer the browser or Chrome integration exposed in the current Codex session; otherwise use an available Playwright MCP or `playwright-cli`. Confirm the base URL responds before opening it. Do not start a server unless the user requested that or the repository's established workflow clearly calls for it.
3. Open the route in a persistent session, validate the reached URL and page identity, then capture a snapshot and screenshot. If authentication redirects away, follow the repository's declared `verifySetup`; use `JOY_TEST_EMAIL` and `JOY_TEST_PASSWORD` only when the project procedure calls for those variables. Never print credential values.
4. When `.omj/baselines/<route-slug>@<viewport>.png` exists, inspect it as a comparison reference. Treat baselines as evidence, not authority over a newer explicit user design.

If the server or every capture backend is unavailable, report the failed preflight and the exact missing prerequisite. Do not edit without observing unless the user explicitly asks for a code-only repair and supplies enough evidence.

## Diagnose and edit

1. Load `$oh-my-joy:frontend-fundamentals`. Inspect the smallest relevant component, hook, style, and test surface. Apply the universal frontend criteria plus project-declared axes before the user has to enumerate them.
2. Compare the live capture with the screenshot, complaint, baseline, and repository rules. Identify the concrete root cause rather than tuning pixels blindly.
3. Use `apply_patch` for the smallest coherent repair. Reuse semantic tokens and existing layout ratios; do not create a new abstraction or dependency for a local defect.
4. Run the repository's targeted typecheck or equivalent static check. Iterate on failures caused by the edit; distinguish pre-existing failures.

## Recheck

Recapture the same route and viewport in the existing browser session, then compare the relevant state. Exercise the reported interaction when the defect is behavioral. Close the session after the final capture.

If the defect remains, diagnose and retry at most twice. After three total attempts, stop adding risk and report the residual mismatch with evidence.

When committing was explicitly requested, inspect `git status`, the diff, and recent commit conventions. Stage only files changed for this defect by explicit path. Never use `git add .`, `git add -A`, `--no-verify`, AI signatures, or `Co-Authored-By` trailers.

## Result

Report each fix with severity, `file:line`, root cause, change, and recapture evidence. Include verification commands and their exit status. If capture or verification could not run, say so plainly rather than claiming the defect is fixed.
