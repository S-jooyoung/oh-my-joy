---
name: setup-neg-install-question
description: "Guard: a plain how-do-I-install question is answered directly; the setup workflow does not take over."
tags: [setup, ablation]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, AskUserQuestion]
---
Figma MCP를 쓰려면 뭘 설치해야 해?
