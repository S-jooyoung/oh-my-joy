---
name: ship-stops-on-red
tags: [ship, evidence]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, "Bash(git status:*)", "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git branch:*)", "Bash(git log:*)", "Bash(npm test:*)", "Bash(node --test:*)", "Bash(npm run typecheck:*)", "Bash(node --check:*)"]
scaffold_script: cp -R "$EVAL_FIXTURES/node-service-failing/." . && git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm base && printf '\nexport const shipped = true;\n' >> src/server.mjs
---
/oh-my-joy:ship "test: ship gate"
