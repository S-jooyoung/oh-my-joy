---
name: review-over-build
description: "A working tree that rebuilds a helper the repository already has and a parser the platform provides, next to one genuinely new function; the review flags the rebuilds with their evidence and leaves the new function alone."
tags: [review, general]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, Agent, "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git ls-files:*)"]
---
The working tree adds money formatting, query-string parsing, and a discount helper for the invoice page.

/oh-my-joy:review
