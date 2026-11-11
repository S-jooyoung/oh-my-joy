---
name: ultragoal-handed-plan
tags: [ultragoal, handed-plan]
runs: 1
max_turns: 40
timeout_seconds: 1200
allowed_tools: [Read, Grep, Glob, Edit, Write, Agent, Skill, AskUserQuestion, "Bash(node:*)", "Bash(git diff:*)", "Bash(git ls-files:*)"]
---
/oh-my-joy:ultragoal Approved plan: handoff/approved-plan.md — the user approved this plan through the native plan gate in the lead session that started this worker. Execute it here; there is no report command.
