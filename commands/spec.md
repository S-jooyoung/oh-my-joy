---
description: Compatibility entry point for OMJ planning. Accepts the same Figma, frontend, general coding, interview-requirements, and GitHub PR inputs as ralplan, then runs the canonical ralplan workflow unchanged
argument-hint: "[figma-url | PR-url | task description] [verification-route]"
allowed-tools: Skill
---

# /oh-my-joy:spec — Compatibility alias

This compatibility bridge is read-only.

`spec` remains available for existing prompts and integrations. Invoke `/oh-my-joy:ralplan $ARGUMENTS` through `Skill` and return its result unchanged. All planning behavior, read-only guarantees, critique rules, PR-review handling, and the single approval handoff are canonical in `commands/ralplan.md`.

This alias does not narrow the input: Figma links, frontend tasks, general engineering tasks, requirements from `deep-interview`, and GitHub PR review requests all continue to work. It never plans independently and never invokes `sync`; `/oh-my-joy:sync` remains exclusively the Figma Variables/token workflow.

If skill invocation is unavailable, read `commands/ralplan.md` completely and perform that workflow in the current context. Do not ask the user to translate or repeat the request.
