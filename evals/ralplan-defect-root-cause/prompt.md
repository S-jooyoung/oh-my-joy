---
name: ralplan-defect-root-cause
tags: [ralplan, defect]
runs: 3
max_turns: 12
timeout_seconds: 900
allowed_tools: [Read, Grep, Glob, Skill]
---
/oh-my-joy:ralplan "formatAmount('1,000') in src/format.mjs throws TypeError: Cannot read properties of undefined (reading 'toFixed') — fix it"
