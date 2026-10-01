---
name: review-plan-constraints
tags: [review, plan]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git ls-files:*)"]
append_system_prompt: |
  Earlier in this session the user approved the following /oh-my-joy:ralplan plan, and the working tree now holds its implementation.

  # Plan: item lookup route

  ## Goal
  Add `GET /api/items/:id` to src/server.mjs.

  ## Constraints
  - no new dependency
  - `handle()` keeps its signature

  ## Non-goals
  - request logging

  ## Acceptance criteria
  1. `GET /api/items/1` returns 200.

  ## Verification commands
  - `npm test`
---
/oh-my-joy:review
