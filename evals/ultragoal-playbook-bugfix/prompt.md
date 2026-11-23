---
name: ultragoal-playbook-bugfix
tags: [ultragoal, playbook]
runs: 1
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Grep, Glob, Write, Edit, Bash, Skill, Agent]
---
/oh-my-joy:ultragoal "formatAmount('1,000') in src/format.mjs throws TypeError: Cannot read properties of undefined (reading 'toFixed'). It is a display-only number formatter for item counts in our CLI. Fix it and add a regression test."
