---
name: review-blind-spots
tags: [review, security]
runs: 3
max_turns: 18
timeout_seconds: 420
allowed_tools: [Read, Grep, Glob, Skill, "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git ls-files:*)"]
---
/oh-my-joy:review
