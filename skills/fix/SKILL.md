---
user-invocable: false
disable-model-invocation: true
name: fix
description: "Fix a specific frontend visual or behavioral defect from a route, screenshot or complaint, then verify the result."
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Fix a frontend defect

Read [the canonical fix command](../../commands/fix.md) and [the canonical capture procedure](../../commands/verify.md) completely before acting. Follow their argument, observe/edit/recheck, retry, commit-gate, and output contracts. This file only maps that contract onto Codex surfaces.

## Codex adapter

- For capture, prefer the browser or Chrome integration exposed in the current Codex session, then an available Playwright integration, then `playwright-cli`. Keep one persistent session across observe, edit, and recheck; validate the reached URL and page identity. Apply `.omj/fe-context.md` `verifySetup` when present, and never print credential values.
- Load `$oh-my-joy:frontend-fundamentals` before diagnosing. Use repository reads for inspection, `apply_patch` for the smallest coherent repair, and the terminal for declared verification commands.
- If the expected behavior is ambiguous or the change is broad, route to `$oh-my-joy:ralplan` instead of guessing.
- A fix request alone does not authorize a commit. With an explicit `--commit` or equivalent current request, commit only after the recapture passes and every applicable check exits 0. Inspect status, diff, recent commit conventions, the current branch, and the repository's shared branches. If currently on a shared branch, create a uniquely named `fix/<short-slug>` branch before staging. Stage only this defect's files by explicit path, create the commit, and report its branch and hash. Never push as part of fix.

If every capture backend or the server is unavailable, stop before editing unless the user explicitly requested a code-only repair and supplied enough evidence. Report the failed preflight or verification honestly; do not claim the defect is fixed without a passing recheck.
