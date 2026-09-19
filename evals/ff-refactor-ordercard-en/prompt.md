---
name: ff-refactor-ordercard-en
description: "English refactor request on a smelly component; matched pair with ff-refactor-ordercard-ko."
tags: [ff, ff-fire, skill, ablation]
runs: 3
max_turns: 16
timeout_seconds: 600
allowed_tools: [Read, Grep, Glob, Skill]
---
`src/components/OrderCard.tsx` is really hard to read. Clean it up without changing what it does. Don't write to the file — reply with the complete cleaned-up file in one code block.
