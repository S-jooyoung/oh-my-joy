---
name: sync-push-no-figma
description: "sync push with no Figma tools in the session: nothing is pushed and no success is claimed."
tags: [sync]
runs: 3
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, Edit, Write, AskUserQuestion]
---
/oh-my-joy:sync push
