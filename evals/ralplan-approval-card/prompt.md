---
name: ralplan-approval-card
tags: [ralplan, report]
runs: 1
max_turns: 14
timeout_seconds: 900
allowed_tools: ["Bash(node */scripts/execution-config.mjs:*)", Read, Grep, Glob, Skill, Agent]
---
/oh-my-joy:ralplan "add GET /api/items/:id to src/server.mjs — 200 with the item as JSON when it exists, 404 with {\"error\":\"not found\"} otherwise — with tests"
