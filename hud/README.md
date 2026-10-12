# OMJ HUD

Claude Code statusLine HUD, vendored from [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) v5.6.2 `dist/hud` (MIT, © 2025 Yeachan Heo — see `NOTICE.md`). Installed by `/oh-my-joy:setup` as a copy at `~/.claude/omj-hud/` with:

```json
"statusLine": { "type": "command", "command": "sh ~/.claude/omj-hud/omj-hud-cache.sh ~/.claude/omj-hud/omj-hud.mjs" }
```

## Layout

- `omj-hud-cache.sh` — POSIX cache wrapper (hot path: cat last render; background refresh; a render younger than `OMJ_HUD_MIN_REFRESH_SECONDS`, default 15, is reused without starting Node). Cache dir: `$CLAUDE_CONFIG_DIR/.omj-hud-cache/` (override: `OMJ_HUD_CACHE_DIR`). Session caches older than `OMJ_HUD_CACHE_TTL_SECONDS` (default 7 days) are swept at most every `OMJ_HUD_SWEEP_INTERVAL_SECONDS` (default 300). The render lock and temp files carry the pid of the shell running the render: the sweep keeps a temp file while that pid is alive and removes it `OMJ_HUD_LOCK_STALE_SECONDS` (default 10) after it exits; a lock held by a live pid is reclaimed once older than `OMJ_HUD_LOCK_MAX_SECONDS` (default 300), and the hung Node process itself is left running. A render that writes stderr leaves it in `stderr.<key>.log`, and the next render that succeeds without stderr removes it.
- `omj-hud.mjs` — loader; imports the vendored bundle (which runs `main()` on import).
- `vendor/hud/index.js` — esbuild bundle of upstream `dist/hud/index.js` (the listed display and install-check strings rebranded OMC→OMJ, with the install-check path pointed at the setup copy; other logic untouched).
- `scripts/session-summary.mjs` — standalone session-summary generator, spawned by the bundle via `vendor/hud/../../scripts/` (missing = graceful skip).
- `find-node.sh` — node resolver for non-interactive shells (nvm/fnm/volta/brew fallbacks).

Adapted copies at v5.6.2: `omj-hud-cache.sh` ports the upstream wrapper changes since v5.0.0 (stdin fast path, pid-owned locks, interval-gated cache sweep) with OMJ names, plus the OMJ-local changes listed under Regenerating; `find-node.sh` and `scripts/session-summary.mjs` had no upstream change.

## HUD-owned state (legacy paths kept, no bundle patch)

- `~/.claude/.omc/hud-config.json` — HUD element config (optional; the `omcHud` key in `~/.claude/settings.json` overrides it).
- `~/.claude/.omc/update-check.json` — if present, renders an "update" segment; safe to delete.
- `~/.claude/plugins/oh-my-claudecode/.usage-cache*.json` (and `.custom-rate-cache.json` with a custom rate provider) — usage caches, recreated automatically.
- `<git root>/.omc/state/hud-stdin-cache.json` — last statusLine input per project. Outside a git repository it goes to the nearest directory holding an `.omc-workspace` marker, else `~/.omc/state/` (v5.0.0 wrote it into the current directory).
- `$CLAUDE_CONFIG_DIR/.omj-hud-cache/` — wrapper cache (`statusline.<key>.txt`, `stdin.<key>.json`, `stderr.<key>.log`, in-flight `statusline.<key>.<pid>.tmp|.err` and `stdin.<pid>.tmp`, `render.<key>.lock/`, `sweep.stamp`, `sweep.lock/`). The 7-day TTL also covers the temp files and `stderr.*.log`.

## Side effects (audited at v5.6.2)

- Network: `api.anthropic.com/api/oauth/usage` for the rate-limit segment and `platform.claude.com/v1/oauth/token` to refresh an expired token. New in v5.6.2: when the usage endpoint answers 403, the bundle sends a one-token `claude-haiku-4-5` request to `api.anthropic.com/v1/messages` with the same OAuth token and reads the rate-limit headers. While the 403 persists the probe repeats once per usage poll window (default 90 s; about every 2 minutes once the probe also fails), and each probe is a billed model request against the subscription. Provider usage endpoints are called only when `ANTHROPIC_BASE_URL` points at z.ai, MiniMax, or Kimi. The GitHub release URLs in the bundle have no call site. Setting `"omcHud": { "elements": { "rateLimits": false } }` in `~/.claude/settings.json` skips all of these.
- Credentials: `CLAUDE_CODE_OAUTH_TOKEN` (new in v5.6.2, checked first), then the macOS Keychain item `Claude Code-credentials` (suffixed with a hash of `CLAUDE_CONFIG_DIR` when set) via `/usr/bin/security`, then `$CLAUDE_CONFIG_DIR/.credentials.json`. A refreshed token is written back to the source it came from.
- Processes: `git`, `/usr/bin/security`, `node scripts/session-summary.mjs` (which runs `claude -p`), and the command of a custom rate provider when one is configured.
- Imports outside the bundle: new in v5.6.2, `better-sqlite3` is required at load through `createRequire`, resolved from the install directory upward; when it is absent the bundle silently uses its file-lock fallback.

## Known limitations

- Codex uses its native CLI footer instead of this bundle. Model, branch, context, and quota indicators are configured through `[tui].status_line`; see [Codex setup](../docs/CODEX-SETUP.md). Codex App has no documented custom HUD slot. The shared answer style is available separately through project instructions.

- Version label reads the first `package.json` with a `name` and `version` up to five levels above the bundle. From a checkout it shows the oh-my-joy version with an `L` (local) suffix. For the installed copy those levels reach `~/.claude`, `~`, and the directory above the home directory, so a `package.json` there shows an unrelated version (and can enable the update hint below); without one the label is plain `[OMJ]`.
- The diagnostic printed when the bundle runs without stdin checks `$CLAUDE_CONFIG_DIR/omj-hud/omj-hud.mjs`, while setup installs to `~/.claude/omj-hud/`; with `CLAUDE_CONFIG_DIR` set elsewhere it reports the script `MISSING` even though the statusLine works.
- A render whose lock was reclaimed past `OMJ_HUD_LOCK_MAX_SECONDS` keeps running; when it finishes it still writes its output and, on a clean success, clears `stderr.<key>.log`. It cannot remove the new owner's lock.
- `OMC_*` env vars (`OMC_DEBUG`, `OMC_STATE_DIR`, …) inside the bundle keep their upstream names.
- Three upstream strings new in v5.6.2 are outside the rebrand list and keep upstream names: the error `Cannot resolve a safe non-git OMC state root` (only when the home directory resolves to the filesystem root), the `npm rebuild better-sqlite3` remediation that names the upstream plugin directory (only when `better-sqlite3` is installed but its native binding fails to load), and the `[!] omc <version> - paste: …` update hint with the upstream install command (only where the version label resolves — a checkout, or an installed copy with a `package.json` in `~/.claude` or `~` — with an update-check cache that names a newer version). Adding them to the list is a decision for the next regeneration.

## Regenerating the bundle

Built with esbuild 0.27.2 (the version upstream pins). Run it from the directory that holds the upstream checkout, so the bundle's path comments read `v5.6.2/dist/...`:

```sh
cd <build-dir>   # contains the release checkout as ./v5.6.2, after npm ci --ignore-scripts
npx esbuild@0.27.2 v5.6.2/dist/hud/index.js --bundle --platform=node --format=esm \
  --outfile=<oh-my-joy>/hud/vendor/hud/index.js
```

Then apply the rebrand list, each string occurring once. The list is the full set of lines that differ between a fresh upstream bundle and the committed one, path comments aside; re-derive it by diffing the previous release's fresh bundle against the committed file before applying it to a new release.

| Upstream | OMJ |
|---|---|
| `` `[OMC${versionTag}] -> ${context.updateAvailable} omc update` `` | `` `[OMJ${versionTag}] -> ${context.updateAvailable} omj update` `` |
| `` `[OMC${versionTag}]` `` | `` `[OMJ${versionTag}]` `` |
| `(configDir, "hud", "omc-hud.mjs")` | `(configDir, "omj-hud", "omj-hud.mjs")` — the path setup installs |
| `sl.command.includes("omc-hud")` | `sl.command.includes("omj-hud")` |
| `sl.includes("omc-hud")` | `sl.includes("omj-hud")` |
| `` `[OMC] HUD v${version} \| preset: ${preset}` `` | `` `[OMJ] HUD v${version} \| preset: ${preset}` `` |
| `"  Run /oh-my-claudecode:hud setup to fix."` | `"  Run /oh-my-joy:setup to fix."` |
| `"[OMC] Starting..."` | `"[OMJ] Starting..."` |
| `"[OMC] run /omc-setup to install properly"` | `"[OMJ] HUD install broken - re-run /oh-my-joy:setup"` |
| `"[OMC] HUD error - check stderr"` | `"[OMJ] HUD error - check stderr"` |
| `"[OMC HUD Error]"` | `"[OMJ HUD Error]"` |

Check: `grep -nE '\[OMC|omc update|/oh-my-claudecode:|omc-hud' hud/vendor/hud/index.js` prints nothing, and a fresh bundle diffs against the committed one on these 11 lines only.

OMJ-local changes to keep when re-porting `omj-hud-cache.sh` (`tests/hud-cache-wrapper.test.mjs` pins the render pid, the lock age ceiling, the stderr log, and the live-pid skip; the non-numeric fallback and the TTL patterns are not pinned):

- Real render pid: `refresh_cache` takes `REFRESH_PID` from a child's `PPID` (not `$$`, which in the background subshell is the exiting wrapper) and names its temp files and lock pid with it.
- Pid-based sweep: temp and `.err` files are skipped while the pid field before their extension is alive; a non-numeric field uses the age rule alone; the TTL `find` also covers them.
- Lock age ceiling: `OMJ_HUD_LOCK_MAX_SECONDS` (default 300) reclaims a lock even when its pid is alive.
- stderr log: non-empty render stderr moves to `stderr.<key>.log`; a later stderr-free successful render removes it.
