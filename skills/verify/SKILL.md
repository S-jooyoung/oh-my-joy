---
user-invocable: false
disable-model-invocation: true
name: verify
description: "Verify completed work; report-only, without source edits. Use a route for browser checks, or run declared checks and report results with evidence."
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Verify

Prove the work and report the evidence. Read [commands/verify.md](../../commands/verify.md) completely before acting and preserve its mode selection, command-discovery precedence, input validation, reached-route check, baseline precedence, credential redaction, evidence table, and verdict rules.

Run verification outside Plan mode because commands, browsers, screenshots, and `.omj/baselines/` artifacts may have side effects. Never edit source files.

## Evidence mode

- Discover commands from the approved ralplan, then `.omj/fe-context.md` `verifyCommands:`, then `package.json` scripts `typecheck`, `lint`, and `test`. Do not guess when none are declared.
- Run each discovered command by itself, exactly as discovered, with the Codex terminal tool (it reports the exit code; a chained or rewritten form may not match the approval), and capture the exact command, exit code, and concise result. A command that did not run is a missing row, not a result inferred from its script. Failing rows come first. Never expose secrets or personal data.
- A test command's row fails even with exit code 0 when its output reports zero tests executed or reports a test the approved plan names as skipped or missing; when the output shows no count, exit code 0 passes with `count not shown` in the summary. A discovered command that never ran fails the verdict.
- If the plan records a route, explicitly report that browser verification is still owed.

## Browser mode

- Prefer an installed Codex browser skill or browser-control tool. Otherwise use Playwright MCP, then `playwright-cli`. Preserve the same navigation, accessibility snapshot, screenshot, comparison, and close-session sequence regardless of backend.
- Validate the route and base URL before interpolation exactly as the canonical workflow requires. Keep user input in quoted variables for shell fallback.
- Confirm that the intended route was reached before comparing visuals. A redirect is a failed reachability check, not a visual comparison.
- Apply `.omj/fe-context.md` `verifySetup:` when present. Never print credentials; warn before persisting an authenticated screenshot that may contain personal data.
- Baselines under `.omj/baselines/` are generated evidence, not source edits. Preserve expired-asset handling and the canonical route-slug convention.

## Design audit

- Run it after the reached-route check when no Figma or baseline reference exists, or on any route with `--design` (whole page in scope). `--design` without a route prints "design audit needs a route" with usage and stops. `$oh-my-joy:fix` reuses the capture procedure but not this audit.
- Read the frontend-fundamentals `visual-design.md` rubric, its `a11y.md` sibling, and the working-tree `designDocPath`; judging an edited design document by its base wording belongs to review.
- Record the current viewport, then set the viewport to desktop 1440×900, tablet 768×1024, and mobile 375×812 (a width declared in fe-context `acceptance` replaces the nearest one), capturing each. Measure horizontal overflow, contrast against the first opaque ancestor background, and interactive target sizes by evaluating the page; judge render tells from the captures. Restore the recorded viewport, and close the session after the audit. Audit captures are not saved as baselines. A backend that cannot resize or evaluate leaves the unmeasured items on `Declined to judge` lines.
- A listed tell is a 🔴 `template tell` inside the audit scope (the approved plan's Design direction scope, or the whole page under `--design`) unless a design source chose it (🟢 note naming the source); outside the scope it is a 🟡 `template tell`, not a fix-loop target, with the hint to declare a deliberate choice in `designDocPath`. Objective defects are 🔴 anywhere. With a Figma reference and `--design`, a conflict with the design is a note for the designer. An unreachable required state goes on a `Declined to judge` line naming its How to check.

If no browser backend is available, report the missing backend and installation/enablement options; do not fabricate a visual verdict. Suggest `$oh-my-joy:fix` for visual defects or `$oh-my-joy:ship` only after a clean pass.

Use `$oh-my-joy:verify [route] [--base URL] [--design]`.
