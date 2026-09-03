---
name: spec-frontend-text
tags: [spec, frontend]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill]
scaffold_script: cp -R "$EVAL_FIXTURES/fe-form/." .
---
/oh-my-joy:spec "search input form — React Hook Form + Zod, mobile first, with an inline error message" /search
