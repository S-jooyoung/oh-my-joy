---
name: ff-feedback-productlist
description: "Feedback-only request on one component file; no edits wanted."
tags: [ff, ff-fire, skill, ablation]
runs: 3
max_turns: 16
timeout_seconds: 600
allowed_tools: [Read, Grep, Glob, Skill]
---
Can you look over `src/components/ProductList.tsx` and tell me what you'd change and why? Don't edit anything, I just want your feedback.
