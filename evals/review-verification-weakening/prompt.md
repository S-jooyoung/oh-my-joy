---
name: review-verification-weakening
tags: [review, evidence]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git ls-files:*)"]
---
/oh-my-joy:review
