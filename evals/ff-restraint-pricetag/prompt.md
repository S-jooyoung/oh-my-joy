---
name: ff-restraint-pricetag
description: "Vague maintainability request on a component that is already clean; the good answer holds back."
tags: [ff, ff-fire, skill, ablation]
runs: 3
max_turns: 16
timeout_seconds: 600
allowed_tools: [Read, Grep, Glob, Skill]
---
Make `src/components/PriceTag.tsx` more maintainable. Don't write to the file — reply with the code you'd end up with and why.
