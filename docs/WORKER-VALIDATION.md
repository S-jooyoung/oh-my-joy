# Worker display validation

The [worker contract](EXECUTION-HANDOFF.md#worker-display-and-lifecycle) is enforced by host instructions, not a custom scheduler. Source tests and policy replay evals do not prove visible panes or host termination. Record native execution, display, and cleanup separately for each host.

## Local capability probe — 2026-11-11

- `codex --version`: `codex-cli 0.167.1`; `claude --version`: `2.1.322 (Claude Code)`.
- `codex --help`, `codex resume --help`, and `codex agents --help` expose `--remote`. `codex app-server generate-ts --experimental --out <temporary-directory>` emits `v2/ThreadResumeParams.ts`, whose contract says a running `threadId` rejoins that active thread on the app server.
- This supplies a candidate connection: `codex --remote <existing-server-endpoint> resume <native-worker-thread-id>`, without a prompt. First establish that the endpoint owns the lead's native worker and that the ID is that worker, then verify the same ID and ongoing turn in both views. A separate server, a resumed historical copy, or a new turn is not an attached view. Do not infer that `resume` alone attaches to the correct server.
- The maintenance session has `TERM=dumb`, no `TMUX`, `TMUX_PANE`, or `TERM_PROGRAM`, and no verified mapping from its native workers to a CLI server endpoint. CLI help and generated types prove an available primitive, not a successful pane connection. No hidden tmux session or replacement CLI worker was started.
- Native work in this maintenance session used two disjoint implementation workers. This is not a live CLI acceptance run for either host. Both hosts' complete display and cleanup matrix below remains **unverified**; Codex pane attachment is **incomplete**.

## Live acceptance matrix

Run in an identified interactive terminal window on each host, using disposable task files and three disjoint report tasks plus one queued task. Capture the main pane ID and an unrelated sentinel pane/session before starting. Use the host's native worker lifecycle, with Claude Agent Teams split display enabled. For Codex, establish the existing server and worker ID mapping above before attaching a view. If any prerequisite is absent, record the limitation and leave display incomplete.

| Scenario | Required observations on Claude and Codex |
| --- | --- |
| One worker | Announce one worker, its role and why sequential work fits; observe its native ID and current-window pane. |
| Three independent tasks | Announce three roles and disjoint ownership; observe overlapping execution of exactly three native workers and three views in the main window. |
| Fourth task | While three are live, queue it without spawning; include an investigator and reviewer in the same total. Start only after confirmed retirement releases a slot. An idle context awaiting a delta pass still occupies a slot. |
| Normal completion | Save result and logs, terminate the worker, confirm termination, then close only its mapped pane. Verify the main and sentinel remain. |
| Worker failure | Save failure and available output, retire the failed worker and its view, and check that capacity is released only after confirmation. Preserve evidence and unrelated panes. |
| Cancellation | Cancel a live batch, save available output and cancellation reason, stop all owned workers, close their views, and verify no queued task launches. Preserve main and sentinel. |
| Missing display or cleanup capability | Report the exact missing capability; keep execution evidence separate and leave the affected acceptance item incomplete. Interruption or an idle status alone is not termination. |

Retain a receipt per row: host/version, command or native operation, worker ID, parent ID, window/pane mapping, start/end times, result/log artifact, termination confirmation, and main/sentinel readback. Never record credentials or authentication endpoints containing secrets. Mark a row passed only from observed evidence, not a narrated or simulated sequence.

`tests/worker-policy.test.mjs` pins the source contract and host links. `evals/worker-lifecycle-policy/` checks policy application to supplied states; its answers are simulations, not live acceptance evidence.
