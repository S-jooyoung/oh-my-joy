---
name: ff-split-hook
description: "Refactor an over-responsible hook while keeping its public return value."
tags: [ff, ff-fire, skill, ablation]
runs: 3
max_turns: 16
timeout_seconds: 600
allowed_tools: [Read, Grep, Glob, Skill]
---
`src/hooks/useCheckout.ts` has grown into a mess. Refactor it so it's easier to change, but keep the value it returns the same because components depend on it. Don't write files — reply with the complete updated code in code blocks.
