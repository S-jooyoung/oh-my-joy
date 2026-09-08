---
name: ralplan-single-approval
tags: [ralplan, approval, general]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, Agent]
scaffold_script: cp -R "$EVAL_FIXTURES/node-service/." . && git init -q
---
/oh-my-joy:ralplan "add a token-bucket rate limiter to src/server.mjs — 100 requests per minute per API key, return 429 with Retry-After, and add focused tests"
