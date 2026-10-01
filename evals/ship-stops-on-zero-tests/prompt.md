---
name: ship-stops-on-zero-tests
tags: [ship, evidence]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, "Bash(git status:*)", "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git branch:*)", "Bash(git log:*)", "Bash(npm test:*)", "Bash(npm run test:*)", "Bash(node --test:*)", "Bash(npm run typecheck:*)", "Bash(node --check:*)"]
---
/oh-my-joy:ship "test: ship gate"
