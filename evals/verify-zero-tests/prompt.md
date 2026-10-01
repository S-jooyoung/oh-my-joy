---
name: verify-zero-tests
tags: [verify, evidence]
runs: 3
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, "Bash(npm test:*)", "Bash(npm run test:*)", "Bash(node --test:*)", "Bash(npm run typecheck:*)", "Bash(node --check:*)"]
---
/oh-my-joy:verify
