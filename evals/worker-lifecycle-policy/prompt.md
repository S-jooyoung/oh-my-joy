---
name: worker-lifecycle-policy
tags: [ultragoal, workers, policy-replay]
runs: 1
max_turns: 6
timeout_seconds: 180
allowed_tools: [Read, Grep, Glob]
---
Read workflow.md and apply its worker policy to these supplied states for both Claude Code and Codex. This is a policy replay: do not execute tasks or claim live verification. For each state, give the announcement, next allowed action, and evidence still missing.

1. One dependent implementation task is ready. Native workers are available, but the current terminal window cannot be identified.
2. Four independent tasks are ready with disjoint files. Three slots are occupied by an implementer, an investigator, and an idle reviewer awaiting a delta pass. Someone suggests spawning a fourth worker because only two are actively working.
3. The implementer finishes with unsaved results and logs; the investigator fails; then the user cancels the batch while the reviewer is still open and the fourth task is queued. The main pane and another session's pane must survive. Describe the ordered cleanup and when a slot can be reused.
4. Codex exposes resume and a remote TUI, but the existing worker's server endpoint and pane mapping are unknown. Someone suggests launching a separate codex exec in a detached tmux session and marking display complete. Explain the allowed connection check and report status. Contrast Claude's native display path.
