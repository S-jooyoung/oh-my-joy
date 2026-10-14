---
name: verify-server-down
tags: [verify]
runs: 3
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, "Bash(command -v:*)", "Bash(playwright-cli:*)"]
---
/oh-my-joy:verify / --base http://127.0.0.1:59173
