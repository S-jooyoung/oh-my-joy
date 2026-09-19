---
name: sync-neg-token-question
description: "Guard: a question about the token structure is answered from the file; the sync workflow does not take over."
tags: [sync, ablation]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, AskUserQuestion]
---
이 프로젝트 색 토큰이 어떤 구조로 되어 있는지 설명해 줘.
