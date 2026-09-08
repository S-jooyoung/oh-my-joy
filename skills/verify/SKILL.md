---
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
- Run commands with the Codex terminal tool and capture the exact command, exit code, and concise result. Failing rows come first. Never expose secrets or personal data.
- If the plan records a route, explicitly report that browser verification is still owed.

## Browser mode

- Prefer an installed Codex browser skill or browser-control tool. Otherwise use Playwright MCP, then `playwright-cli`. Preserve the same navigation, accessibility snapshot, screenshot, comparison, and close-session sequence regardless of backend.
- Validate the route and base URL before interpolation exactly as the canonical workflow requires. Keep user input in quoted variables for shell fallback.
- Confirm that the intended route was reached before comparing visuals. A redirect is a failed reachability check, not a visual comparison.
- Apply `.omj/fe-context.md` `verifySetup:` when present. Never print credentials; warn before persisting an authenticated screenshot that may contain personal data.
- Baselines under `.omj/baselines/` are generated evidence, not source edits. Preserve expired-asset handling and the canonical route-slug convention.

If no browser backend is available, report the missing backend and installation/enablement options; do not fabricate a visual verdict. Suggest `$oh-my-joy:fix` for visual defects or `$oh-my-joy:ship` only after a clean pass.

Use `$oh-my-joy:verify [route] [--base URL]`.
