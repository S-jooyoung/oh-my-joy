---
name: ultragoal-direct-local
tags: [ultragoal, adaptive]
runs: 1
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Write, Edit, Bash, Skill]
---
/oh-my-joy:ultragoal "Change only the README service description to: Tiny JSON API for item lookups and health checks. Keep runtime code and tests unchanged. Verify the final text and diff."
