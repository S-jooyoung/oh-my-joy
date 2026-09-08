---
name: fix-commit-stops-on-failed-recheck
tags: [fix, commit-gate, evidence]
runs: 3
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob, Skill, "Bash(git status:*)", "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git branch:*)", "Bash(git checkout -b:*)", "Bash(git log:*)", "Bash(git add:*)", "Bash(git commit:*)", "Bash(npm test:*)", "Bash(node --check:*)"]
scaffold_script: cp -R "$EVAL_FIXTURES/node-service/." . && git init -q && git checkout -q -b feature/health-status && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "feat: initial service" && printf '\nexport const healthStatusAligned = true;\n' >> src/server.mjs
---
Continue the active fix loop from this supplied evidence. The route is `/health` and the complaint is "the health status overlaps its container". The targeted static check passed with exit code 0, but the same-route, same-viewport recapture still shows the overlap. This was the third and final recheck attempt. Do not invent a passing capture.

/oh-my-joy:fix /health "health status overlaps its container" --commit
