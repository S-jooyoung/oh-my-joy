# Runtime adapters

OMJ owns scope, acceptance and evidence. A native host, Herdr or Orca ADE owns agent processes, transport and workspaces. This is a protocol adapter, not another daemon or scheduler.

## Select and inspect

`runtime:auto` uses the current managed environment when it is positively identified and its API is available; otherwise use native host agents. If two external environments are detected without a clear current owner, use native and report the ambiguity. A specifically selected unavailable runtime blocks dispatch rather than silently targeting a different installation. Single-host inline work remains available.

| Runtime | Source of executable operations |
| --- | --- |
| Native | Tools exposed by this session, their current schema and actual limits |
| Herdr app | Installed `~/.config/herdr-app/AGENTS.md`, then `hc --help` and `hc --skill` for version-matched core operations |
| Orca ADE (`stablyai/orca`) | Installed orchestration skill; resolve its session CLI and load `skills get orchestration` before operations |

Do not confuse Herdr app with Herdr TUI, or Orca ADE with another `orca` executable. Honor the Orca skill's platform/session executable resolution; on Linux an unrelated screen reader can use that name. If a CLI is unavailable, do not install, upgrade or launch an application silently. Read the tool's current manual rather than embedding guessed CLI flags in OMJ. Personal skill files are discovery aids, not plugin dependencies: without one, use that runtime's official version-matched help and report capabilities that cannot be verified.

## Read-only planning capacity

Planning reviewers share the same resolved `maxWorkers` and host limit. Resolve explicit overrides with `--resolve` before dispatch, then use `--capacity` for every launch with an in-memory roster, including exploration, retained reviewers and uncertain sessions. Planning creates no configuration or ledger files. At one slot, collect and stop the first reviewer before launching the second; pass only the draft and relevant delta to a fresh reviewer when another round needs a retired lens. Confirm stopped state before freeing capacity. Host or repository limits can lower the maximum. If capacity or configuration cannot be determined, report the independent pass unavailable rather than guessing.

## Leader-owned dispatch

1. Capture effective configuration and the approved scope before dispatch. Resolve leader preference: continue on the actual host when it matches; otherwise use a supported explicit handoff, read its acknowledgement, and retire leadership here before the new lead writes. If no safe handoff exists, report the mismatch and stop mixed dispatch. Never claim that setting `leader` changed the running model.
2. The lead keeps a task roster under its own `.omj/goals/<slug>/runtime.json`: task ID, configuration, selected runtime, each assignment ID, attempt ID, host, runtime session ID, worktree, owned files, acceptance, check command, and last observed state. Only the lead writes this record; it is operational state, not completion evidence. Resume reloads it and queries every known session before any launch. An unavailable or ambiguous session remains `unknown`; it is not restarted on a timeout alone.
3. Before every launch, call `execution-config.mjs --capacity` with a fresh roster snapshot, including reviewers and pending launches, and the actual host limit when exposed. Reserve the assignment as `starting` in the roster before invoking the runtime, launch at most the returned capacity, then attach the returned session identity. One lead serializes launches; workers cannot delegate. On a crash between launch and identity recording, locate the session by assignment/attempt ID through the runtime; if reconciliation is impossible, block rather than duplicate it.
4. Supply the approved plan, assignment/attempt IDs, exclusive file ownership, acceptance and check command. Use worktree isolation for concurrent external implementers. Shared files belong to the lead. If isolated workspaces are unavailable, execute sequentially rather than permitting overlapping writers. Worker configuration uses only verified model IDs, passed as argument values rather than shell command fragments. `mixed` requires both host families over the task's assignments; it does not force simultaneous work when the cap is one.
5. Workers return changed files, revision identity, check/exit/result and blockers, without spawning more sessions or expanding scope. Native teammates return evidence to the lead; external full OMJ sessions use [handed plans](CROSS-HOST.md) and their own ledger. A runtime's 'finished' badge is a report, not proof. Match task and attempt IDs and revision; ignore duplicate receipts and reject stale results.
6. The lead reads the diff and evidence, integrates the owned changes, and verifies the combined result before recording goal completion. Conflicting edits remain incomplete until resolved and rechecked. Do not discard existing dirty worktrees or overwrite unrelated work.
7. Stop only sessions this task created, verify their stopped state, then free capacity. A completed response with a live idle session still occupies its slot. Resume reuses observed live workers, retains completed receipts and retries only confirmed failed/stopped assignments with a new attempt ID.

A runtime failure before dispatch can use a documented same-host fallback only when the requested composition and review policy permit it; report the fallback. Never switch a required cross-host review to same-host or claim mixed implementation when only one family ran. Existing leader locks and ledger revisions remain the durable writer boundary; do not use a second live leader to recover a first one whose ownership is uncertain.

## Validation boundary

A protocol test or stub proves a branch, not a real integration. For each advertised environment record version, actual session identity, one dispatch/return/stop cycle, and the observed maximum active count. Include a failure/reconciliation replay. Mark unavailable native UIs, runtimes and platforms as unverified. Do not repeat paid probes as final fingerprint checks.
