---
name: review-fail-closed
tags: [review, evidence, fallback-only]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, "Bash(git diff:*)", "Bash(git rev-parse:*)"]
---
/oh-my-joy:review
