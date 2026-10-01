---
user-invocable: false
disable-model-invocation: true
name: deep-interview
description: "Clarify fuzzy requirements through an interview, then hand the agreed requirements to ralplan. Use when the user asks to explore the idea before planning."
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Deep interview

Turn a vague idea into verifiable requirements without implementing it. This is the Codex adapter for the canonical workflow in [commands/deep-interview.md](../../commands/deep-interview.md). Read that file completely before acting and preserve its suitability gate, topology round, scoring formula and floor, ontology check, round limits, exit gates, output contract, and exit bridge.

## Codex tool mapping

- Use repository search/read tools (`rg`, `rg --files`, and file reads) for brownfield facts. Ask nothing the repository already answers.
- Use Codex structured user input when it is available. Ask only when two plausible answers would change the requirements differently (scope, an acceptance criterion, or a constraint); otherwise record the likely answer as an exposed assumption. Ask one material question per round, or up to three in the same structured request when each targets a different component × dimension pair and no answer could change another, with mutually exclusive choices and free-form input. If structured input is unavailable, ask one concise plain-text question and end the turn.
- Invoke the installed `oh-my-joy:ralplan` skill automatically at the exit bridge. Do not ask a final routing question or require the user to repeat the command. If invocation is unavailable, read and perform the canonical ralplan workflow in the current context.
- Do not edit files, apply patches, run side-effectful commands, or spawn implementation agents.

## Native Plan handoff

Requirements are not an implementation plan. `ralplan` always owns planning and renders exactly one `<proposed_plan>` block; there is no direct-plan exception. That block is the sole approval handoff before `ultragoal` execution.

## Graceful degradation

- If repository tools are unavailable, continue as a greenfield interview and label repository context as unverified.
- If the session cannot invoke or read the planner, print the exact `$oh-my-joy:ralplan` invocation.
- An early exit after round 3 or the round-20 cap goes through the exit bridge with the restated goal and a Residual gaps row naming each open gap, rather than extending the interview; an explicit stop ends without a handoff.

Use `$oh-my-joy:deep-interview <idea> [--threshold N]`. Empty input prints usage and stops.
