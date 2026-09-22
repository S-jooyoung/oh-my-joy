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
- Use Codex structured user input when it is available. Each round asks one question per active component that still has a gap, up to four in one call, with mutually exclusive choices, free-form input, and the option the evidence favors listed first; a component's next question waits until its last one is answered. If structured input cannot carry several questions at once, ask them one at a time in the same round, ordered by weakest score. If structured input is unavailable entirely, ask one concise plain-text question and end the turn.
- Invoke the installed `oh-my-joy:ralplan` skill automatically at the exit bridge. Do not ask a final routing question or require the user to repeat the command. If invocation is unavailable, read and perform the canonical ralplan workflow in the current context.
- Do not edit files, apply patches, run side-effectful commands, or spawn implementation agents.

## Native Plan handoff

Requirements are not an implementation plan. `ralplan` always owns planning and renders exactly one `<proposed_plan>` block; there is no direct-plan exception. That block is the sole approval handoff before `ultragoal` execution.

## Graceful degradation

- If repository tools are unavailable, continue as a greenfield interview and label repository context as unverified.
- If the session cannot invoke or read the planner, print the exact `$oh-my-joy:ralplan` invocation.
- At round 20, stop and report residual ambiguity rather than extending the interview.

Use `$oh-my-joy:deep-interview <idea> [--threshold N]`. Empty input prints usage and stops.
