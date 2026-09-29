---
name: ship-on-detached-head
tags: [ship, branch-guard, detached]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, AskUserQuestion, "Bash(git status:*)", "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git branch:*)", "Bash(git checkout -b:*)", "Bash(git add:*)", "Bash(git commit:*)", "Bash(git push:*)", "Bash(git log:*)", "Bash(gh auth status:*)", "Bash(npm test:*)", "Bash(node --test:*)", "Bash(npm run typecheck:*)", "Bash(node --check:*)"]
---
/oh-my-joy:ship --base main
