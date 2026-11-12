# Execution configuration

Configure through `/oh-my-joy:setup` (Claude) or `$oh-my-joy:setup` (Codex). No budget question is required.

| Key | Values | Default |
| --- | --- | --- |
| `leader` | `current`, `codex`, `claude` | `current` |
| `workers` | `current`, `codex`, `claude`, `mixed` | `current` |
| `maxWorkers` | positive integer | `2` |
| `runtime` | `auto`, `native`, `herdr`, `orca` | `auto` |
| `crossReview` | `off`, `preferred`, `required` | `off` |
| `models` | optional `codex` and `claude` model IDs | host defaults |

Personal file: `~/.config/oh-my-joy/config.json`. Project file: `.omj/config.json`. Resolution is explicit task override, project, personal, default. Model entries merge per host. Never store credentials here. Only offer model IDs confirmed available by the active host; an absent model keeps the host default. No model-family routing is inferred from an installed CLI.

The legacy `.omj/fe-context.md` `crossReview` declaration is project-level. Explicit JSON project/request values win except that a legacy `required` conflict blocks until the user resolves it; the helper prints conflicts rather than silently reducing the guarantee. Existing ledgers retain their bound review mode. Keep frontend context in fe-context; do not move unrelated declarations during setup.

## Setup procedure

1. Inspect both files and the available host/runtime capabilities. Run `node <plugin-root>/scripts/execution-config.mjs --check` from the target directory; it finds the Git root, or uses cwd outside Git. It reads only and reports effective values, source labels, paths and conflicts. Missing CLI authentication is separate from an executable existing.
2. Offer leader, worker composition and maximum workers together using the question rules in [adaptive execution](ADAPTIVE-EXECUTION.md). Runtime and model overrides are optional. Show the current values and ask which scope to save; default to project unless the user requested a personal default. Reuse choices already authorized.
3. Merge only selected keys with the existing JSON. Preserve unrelated supported keys, make a backup before replacing an existing file, and use an atomic temporary-file rename. On malformed JSON, show the error and preserve it until a repair is explicitly selected. An unknown key is an error, never a silently ignored setting. Read-only check mode writes no backup, receipt, directory, or config.
4. Run the helper again and report the effective result, including overrides from other scopes. Re-running the same choices preserves the same values. Changes apply to new work; an active task keeps its captured configuration until a deliberate reconfiguration with all workers reconciled.

## Runtime inputs

`--resolve` reads a request-override JSON object from stdin and loads the same files. `--route` reads route facts; `--capacity` reads `{maxWorkers, hostLimit?, active:[{id,state}]}`. Both return JSON and are read-only. Pass JSON through stdin, not shell interpolation. All helpers are dependency-free Node modules; they neither start agents nor bypass permissions.

`maxWorkers` excludes the lead and includes every OMJ-managed implementer and reviewer in this task, across both hosts and all runtimes. `starting`, `running`, `waiting`, and `unknown` consume a slot. Only confirmed `stopped` frees one. The actual host limit can lower the configured maximum. Unrelated user sessions are not controlled and machine-wide capacity is not promised. Nested dispatch is prohibited. At one slot, implementation and review run sequentially.
