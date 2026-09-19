---
name: setup-check-readonly
description: "setup --check in a project that declares fe-context and a CSS token store: inspection table only."
tags: [setup]
runs: 3
max_turns: 16
timeout_seconds: 300
allowed_tools: [Read, Skill, Edit, Write, AskUserQuestion, "Bash(command -v:*)", "Bash(claude plugin list:*)", "Bash(test:*)", "Bash(grep:*)"]
---
/oh-my-joy:setup --check
