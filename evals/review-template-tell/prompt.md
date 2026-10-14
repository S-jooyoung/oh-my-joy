---
name: review-template-tell
tags: [review, frontend]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git ls-files:*)"]
append_system_prompt: |
  Earlier in this session the user approved the following /oh-my-joy:ralplan plan, and the working tree now holds its implementation.

  # Plan: landing page

  ## Goal
  Add a landing page at `/` (src/app/page.tsx) with a hero and a feature summary (src/components/landing/Features.tsx).

  ## Design direction
  - Context: shoppers who compare prices across stores; the page's job is to send them to search.
  - Token plan: --color-fg-primary, --color-surface-default, and --color-brand-primary from src/tokens/colors.css; the hero keeps the brand gradient that docs/DESIGN.md declares.
  - First viewport: (1) the headline, (2) the "Start searching" link, (3) the feature summary.
  - States: a static page with no loading, empty, or error state (How to check: browser capture).
  - Tell check:
    - T1 purple, violet, or indigo gradient background — chosen by docs/DESIGN.md (hero only)
    - T2 symmetric three-column grid of icon, bold title, and one short line — avoided
    - T3 icons inside tinted circles as section decoration — avoided
    - T4 every heading, paragraph, and card center-aligned — avoided
    - T5 one large radius on every element — avoided
    - T6 decorative blobs, floating circles, or wavy dividers — avoided
    - T7 emoji used as icons, bullets, or decoration — avoided
    - T8 a colored left border as a card accent — avoided
    - T9 generic hero copy — avoided
    - T10 every section the same height and pattern — avoided
    - T11 identical rounded cards with a gradient wash — avoided
    - T12 one headline word in a different color or gradient — avoided

  ## Acceptance criteria
  1. `/` renders the hero and the feature summary.
  2. None of the tells listed in this Design direction appears on `/`, except those marked with their chosen source.

  ## Verification commands
  - `npm run typecheck`
---
/oh-my-joy:review
