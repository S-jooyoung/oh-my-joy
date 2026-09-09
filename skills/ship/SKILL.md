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

Read [the canonical ship command](../../commands/ship.md) completely before acting. Follow its authorization, verification, isolation, branch, commit, base-selection, push, PR-body, readback, and output contracts. This file only maps that contract onto Codex surfaces.

## Codex adapter

- Treat a direct `$oh-my-joy:ship` invocation or an explicit current request to ship, push, or create the PR as authorization for the requested external actions. Hypothetical discussion and dry runs remain read-only.
- Use repository reads and the terminal for inspection, verification, git, and GitHub CLI operations. Use native structured user input only when the canonical base-resolution rules leave multiple genuine remote shared-branch candidates.
- Verification must complete successfully before any push. Preserve the canonical shared-branch and explicit-staging safeguards: never commit or push the implementation directly from a shared branch. Never use `git add .`, `git add -A`, hook bypasses, AI signatures, or `Co-Authored-By` trailers.
- An ordinary fast-forward push to an existing remote feature branch is allowed by a shipping request. If the push would be non-fast-forward or the histories have diverged, stop and report the conflict. Never force-push or overwrite divergent remote history.
- Preserve the repository PR template and language, include actual verification evidence, and read back the created PR URL and visible metadata before reporting completion.

Do not merge, release, or deploy as part of ship. Report the exact completed boundary when authentication, verification, isolation, push, or PR creation stops the workflow.
