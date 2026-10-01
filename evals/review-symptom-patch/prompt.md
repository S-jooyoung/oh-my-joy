---
name: review-symptom-patch
tags: [review, defect]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, "Bash(git diff:*)", "Bash(git rev-parse:*)"]
---
formatAmount('1,000') threw "TypeError: Cannot read properties of undefined (reading 'toFixed')". The working tree fixes it.

/oh-my-joy:review
