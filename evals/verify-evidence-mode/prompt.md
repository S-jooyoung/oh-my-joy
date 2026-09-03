---
name: verify-evidence-mode
tags: [verify, evidence]
runs: 3
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, "Bash(npm test:*)", "Bash(node --test:*)", "Bash(npm run typecheck:*)", "Bash(node --check:*)"]
scaffold_script: cp -R "$EVAL_FIXTURES/node-service-failing/." .
---
/oh-my-joy:verify
