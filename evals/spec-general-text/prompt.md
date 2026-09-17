---
name: spec-general-text
tags: [spec, general]
runs: 3
max_turns: 12
timeout_seconds: 900
allowed_tools: [Read, Grep, Glob, Skill]
---
/oh-my-joy:spec "add a rate limiter to the public API — 100 requests per minute per API key, 429 with a Retry-After header when exceeded"
