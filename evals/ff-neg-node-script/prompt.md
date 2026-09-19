---
name: ff-neg-node-script
description: "Guard: a Node CLI script in the same repo is not component work, so the skill stays out."
tags: [ff, ff-guard, skill, ablation]
runs: 3
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill]
---
Clean up `scripts/sync-orders.mjs` — the nested ifs are hard to follow. Keep the behavior the same. Don't write to the file — reply with the complete script in one code block.
