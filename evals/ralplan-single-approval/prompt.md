---
name: ralplan-single-approval
tags: [ralplan, approval, general]
runs: 3
max_turns: 12
timeout_seconds: 600
allowed_tools: ["Bash(node */scripts/execution-config.mjs:*)", Read, Grep, Glob, Skill, Agent]
---
/oh-my-joy:ralplan "add a token-bucket rate limiter to src/server.mjs — 100 requests per minute per API key, return 429 with Retry-After, and add focused tests"
