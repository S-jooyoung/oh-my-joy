---
name: setup-help
description: "setup --help prints usage and stops without inspecting anything."
tags: [setup]
runs: 3
max_turns: 6
timeout_seconds: 300
allowed_tools: [Read, Skill, Edit, Write, AskUserQuestion, "Bash(command -v:*)", "Bash(claude plugin list:*)", "Bash(test:*)", "Bash(grep:*)"]
---
/oh-my-joy:setup --help
