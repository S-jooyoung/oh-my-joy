---
name: fake-done-blind-spots
description: "A plain merge-readiness request on a change that breaks a caller outside the diff, opens an injection, and adds unwired code."
tags: [fake-done, review, ablation]
runs: 3
max_turns: 18
timeout_seconds: 420
allowed_tools: [Read, Grep, Glob, Skill, "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git ls-files:*)"]
---
My coding agent finished this change and says it's done. The change is uncommitted in the working tree. Review it and tell me whether it is ready to merge. Read only — don't edit any files.
