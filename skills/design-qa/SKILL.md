---
name: design-qa
description: "Internal read-only frontend QA for types, lint, tokens, Figma and accessibility. Report findings without fixing code."
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Design QA

Run mechanical frontend gates and report; never edit. Read [agents/design-qa.md](../../agents/design-qa.md) completely and preserve its unconditional checks, project-declared conditional checks, binary verdict, and clean-worktree requirement. Read [frontend-fundamentals](../../skills/frontend-fundamentals/SKILL.md) and [Figma fidelity](../../skills/frontend-fundamentals/references/figma-fidelity.md) for the relevant checks.

## Codex execution rules

- Invoke explicitly after implementation and outside Plan mode.
- Capture `git status --short` before and after the run. Generated caches may appear, but tracked source must not change; report any artifact left behind.
- Run the repository typecheck or `npx tsc --noEmit`, and the repository linter without `--fix`.
- Inspect changed frontend files with `rg` for raw color values, fixed pixel widths, missing `alt`, click handlers on non-interactive elements, and toggles missing `aria-expanded`. Exclude token and configuration files where the canonical contract says to.
- Read `.omj/fe-context.md`; only check Storybook, i18n pairs, or a production build when that file or the caller activates them.
- Do not apply patches, run formatting, use fix flags, commit, or delegate.

Return a pass/fail table with command evidence and `file:line` evidence for every failure, then `PASS` or `FAIL: n items`. Qualitative review belongs to `$oh-my-joy:review`; visual correction belongs to `$oh-my-joy:fix`.
