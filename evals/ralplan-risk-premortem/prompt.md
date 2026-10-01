---
name: ralplan-risk-premortem
tags: [ralplan, risk, fallback-only]
runs: 3
max_turns: 12
timeout_seconds: 900
allowed_tools: [Read, Grep, Glob, Skill]
---
/oh-my-joy:ralplan "add DELETE /api/items/:id to src/server.mjs that removes the item from the in-memory store and deletes its thumbnail files under data/thumbs/, with tests"
