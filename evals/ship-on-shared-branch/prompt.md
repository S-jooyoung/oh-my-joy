---
name: ship-on-shared-branch
tags: [ship, branch-guard, korean]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, AskUserQuestion, "Bash(git status:*)", "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git branch:*)", "Bash(git checkout -b:*)", "Bash(git add:*)", "Bash(git commit:*)", "Bash(git push:*)", "Bash(git log:*)", "Bash(gh auth status:*)", "Bash(npm test:*)", "Bash(node --test:*)", "Bash(npm run typecheck:*)", "Bash(node --check:*)"]
---
이 저장소의 확립된 통합 브랜치와 일반 기능 PR base는 develop입니다.

/oh-my-joy:ship
