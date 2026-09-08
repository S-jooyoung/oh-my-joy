---
name: review
description: Use to review a working-tree or branch diff without editing it. Checks frontend changes against frontend-fundamentals, accessibility and Figma fidelity, checks general changes for correctness, simplicity, consistency and tests, supports delta re-review, and adds an independent native Codex critic pass for non-trivial diffs.
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Review

Review and report; never fix. Read [commands/review.md](../../commands/review.md) completely before acting and preserve its preflight, classification, rubric, severity meanings, re-review convergence rules, and output format. Load [frontend-fundamentals](../../skills/frontend-fundamentals/SKILL.md) and the relevant references for frontend files.

## Codex tool mapping

- Use read-only terminal commands for `git rev-parse` and `git diff`; use repository file reads and `rg` for surrounding context.
- Default diff: `git diff HEAD`. With `--base REF`: `git diff REF...HEAD`. Preserve the staged and empty-diff fallbacks in the canonical workflow.
- Do not use `apply_patch`, formatters, linters with fix flags, commits, or any other mutation.
- For a diff touching at least three files or introducing an abstraction, use one native Codex subagent with the installed `oh-my-joy:critic` skill in implementation-review mode. Pass the diff and approved plan. Merge and de-duplicate its findings. If subagents are unavailable or prohibited, continue locally and state the missing independent pass in one line.
- Use official current Next.js documentation for version-sensitive findings when accessible. Mark a missing optional review layer as skipped, not failed.

If an approved OMJ ralplan exists in session context, acceptance criteria and scope boundaries are review inputs. On repeat runs, judge prior findings first and then only the delta. This skill never modifies source, even when the user says to “review and fix”; report the review and route fixes to the normal implementation flow.

Use `$oh-my-joy:review [--base REF]`.
