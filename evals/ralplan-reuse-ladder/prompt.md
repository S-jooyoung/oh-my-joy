---
name: ralplan-reuse-ladder
description: "A small feature request on a repository that already has the helper the request needs; the plan reuses it, picks the platform parser, names one check for the new branch, and lists what it hands back."
tags: [ralplan, general]
runs: 3
max_turns: 12
timeout_seconds: 900
allowed_tools: [Read, Grep, Glob, Skill]
---
/oh-my-joy:ralplan "add GET /api/subscribe?email=… to the service — respond 400 when the email is invalid and 202 otherwise"
