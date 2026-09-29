---
name: ralplan-experiment-plan
tags: [ralplan, experiment]
runs: 3
max_turns: 12
timeout_seconds: 900
allowed_tools: [Read, Grep, Glob, Skill]
---
/oh-my-joy:ralplan "make lookupAll in src/items.mjs faster — npm run bench prints lookup_ms; keep the tests green"
