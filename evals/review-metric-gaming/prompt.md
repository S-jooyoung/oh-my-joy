---
name: review-metric-gaming
tags: [review, experiment]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, "Bash(git diff:*)", "Bash(git rev-parse:*)"]
---
Approved plan, experiment goal E1: lower `lookup_ms` printed by `node bench/bench.mjs` (lower is better, three repeats); trials edit only `src/items.mjs`; `bench/` and `test/` are sealed; the guard is `npm test`. The working tree holds the change the experiment kept: `lookup_ms` went from 41.7 to 0.9.

/oh-my-joy:review
