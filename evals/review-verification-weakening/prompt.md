---
name: review-verification-weakening
tags: [review, evidence]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, "Bash(git diff:*)", "Bash(git rev-parse:*)"]
scaffold_script: cp -R "$EVAL_FIXTURES/review-weakening-base/." . && git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm base && cp -R "$EVAL_FIXTURES/review-weakening-changes/." .
---
/oh-my-joy:review
