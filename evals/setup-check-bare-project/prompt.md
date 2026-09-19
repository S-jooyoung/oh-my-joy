---
name: setup-check-bare-project
description: "setup --check in a project with no OMJ declarations: missing items are guidance, not errors."
tags: [setup]
runs: 3
max_turns: 16
timeout_seconds: 300
allowed_tools: [Read, Skill, Edit, Write, AskUserQuestion, "Bash(command -v:*)", "Bash(claude plugin list:*)", "Bash(test:*)", "Bash(grep:*)"]
---
/oh-my-joy:setup --check
