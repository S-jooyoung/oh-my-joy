---
user-invocable: false
disable-model-invocation: true
name: ship
description: "Ship finished work only on an explicit request: verify, commit, push and open a pull request."
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Ship verified work

Read [the canonical ship command](../../commands/ship.md) completely before acting. Follow its authorization, verification, branch, commit, base, push, PR-body, and output contracts; this file maps them onto Codex.

## Codex adapter

- A direct `$oh-my-joy:ship` invocation or an explicit request to ship, push, or open the PR authorizes those external actions; hypothetical discussion and dry runs stay read-only.
- Use repository reads and the terminal for inspection, verification, git, and `gh`. Use native structured user input only when the canonical base-resolution rules leave multiple genuine remote shared-branch candidates.
- Retire every native subagent this session started that has returned its result before verification; one still running stops the run before verification.
- Verification passes before any push. A test command's row fails even with exit code 0 when its output reports zero tests executed or reports a test the approved plan names as skipped or missing, and any failing row, or a command that never ran, stops the run before the commit; output with no count passes on exit 0 with `count not shown` in the summary.
- Preserve the canonical shared-branch and explicit-staging safeguards: never commit or push the implementation directly from a shared branch or a detached HEAD. Never use `git add .`, `git add -A`, hook bypasses, AI signatures, or `Co-Authored-By` trailers.
- An ordinary fast-forward push to an existing remote feature branch is allowed by a shipping request. If the push would be non-fast-forward or the histories have diverged, stop and report the conflict. Never force-push or overwrite divergent remote history.
- The PR body uses the repository template, else the five parts as headings, in the repository's language: one line per check, one naming where the evidence lives, 40 lines at most. Read back the PR URL.
- Report in five parts — Conclusion, Your move, What changed, Decisions made for you, How it was checked — as [REPORTING.md](../../docs/REPORTING.md) describes, also when verification stops the run.

Do not merge, release, or deploy as part of ship. Report the exact completed boundary when authentication, verification, isolation, push, or PR creation stops the workflow.
