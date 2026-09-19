---
name: sync-check-no-figma
description: "sync check with no Figma tools in the session: no fabricated drift report, no edits."
tags: [sync]
runs: 3
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, Edit, Write, AskUserQuestion]
---
/oh-my-joy:sync check
