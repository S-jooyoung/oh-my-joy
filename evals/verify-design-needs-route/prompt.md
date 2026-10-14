---
name: verify-design-needs-route
tags: [verify]
runs: 3
max_turns: 6
timeout_seconds: 180
allowed_tools: [Read, Grep, Glob, "Bash(npm test:*)", "Bash(npm run test:*)", "Bash(node --test:*)"]
---
/oh-my-joy:verify --design
