# OMJ HUD

Claude Code statusLine HUD, vendored from [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) v5.8.6 `dist/hud` (MIT, © 2025 Yeachan Heo — see `NOTICE.md`). Installed by `/oh-my-joy:setup` as a copy at `~/.claude/omj-hud/` with:

```json
"statusLine": { "type": "command", "command": "sh ~/.claude/omj-hud/omj-hud-cache.sh ~/.claude/omj-hud/omj-hud.mjs" }
```

## Layout

- `omj-hud-cache.sh` — POSIX cache wrapper (hot path: cat last render; background refresh; a render younger than `OMJ_HUD_MIN_REFRESH_SECONDS`, default 15, is reused without starting Node). Cache dir: `$CLAUDE_CONFIG_DIR/.omj-hud-cache/` (override: `OMJ_HUD_CACHE_DIR`). Session caches older than `OMJ_HUD_CACHE_TTL_SECONDS` (default 7 days) are swept at most every `OMJ_HUD_SWEEP_INTERVAL_SECONDS` (default 300). The render lock and temp files carry the pid of the shell running the render: the sweep keeps a temp file while that pid is alive and removes it `OMJ_HUD_LOCK_STALE_SECONDS` (default 10) after it exits; a lock held by a live pid is reclaimed once older than `OMJ_HUD_LOCK_MAX_SECONDS` (default 300), and the hung Node process itself is left running. A render that writes stderr leaves it in `stderr.<key>.log`, and the next render that succeeds without stderr removes it.
- `omj-hud.mjs` — loader; imports the vendored bundle (which runs `main()` on import). When the bundle fails to load, it prints `[OMJ HUD] HUD failed to load: <error>` as the status line (whitespace collapsed, cut at 100 characters) and the full error to stderr.
- `vendor/hud/index.js` — esbuild bundle of upstream `dist/hud/index.js` (the listed display and install-check strings rebranded OMC→OMJ, with the install-check path pointed at the setup copy, and two module-local constants renamed; other logic untouched).
- `scripts/session-summary.mjs` — standalone session-summary generator, spawned by the bundle via `vendor/hud/../../scripts/` (missing = graceful skip).
- `find-node.sh` — node resolver for non-interactive shells (nvm/fnm/volta/brew fallbacks).

Adapted copies at v5.8.6: `omj-hud-cache.sh` carries the upstream cache wrapper changes since v5.0.0 (stdin fast path, pid-owned locks, interval-gated cache sweep) with OMJ names, plus the OMJ-local changes listed under Regenerating. Upstream's cache wrapper (`scripts/lib/hud-cache-wrapper.sh`), `find-node.sh`, and `scripts/session-summary.mjs` are unchanged between v5.6.2 and v5.8.6. The upstream changes in that range sit in its Node loader (`scripts/lib/hud-wrapper-template.txt`) and in the bundle:

- Load-failure line: ported to `omj-hud.mjs` (see Layout).
- npm fallback limited to global prefixes, with `npm_config_*` removed before `npm root -g`: not applicable. Upstream's loader searches the plugin cache, the marketplace clone, and npm packages; `omj-hud.mjs` imports only the bundle beside it and never resolves an npm package.
- Per-session stdin cache: part of the bundle (see the state paths below).

Effort segment: the bundle shows `effort:<level>` from the statusLine stdin field `effort.level` (upstream type `StatuslineStdin.effort.level` at v5.8.6) next to the model, on by default in every preset, and nothing when the field is absent. Hide it with `"omcHud": { "elements": { "effort": false } }` in `~/.claude/settings.json`.

## HUD-owned state (legacy paths kept, no bundle patch)

- `~/.claude/.omc/hud-config.json` — HUD element config (optional; the `omcHud` key in `~/.claude/settings.json` overrides it).
- `~/.claude/.omc/update-check.json` — if present, renders an "update" segment; safe to delete.
- `~/.claude/plugins/oh-my-claudecode/.usage-cache*.json` (and `.custom-rate-cache.json` with a custom rate provider) — usage caches, recreated automatically.
- `<git root>/.omc/state/sessions/<session id>/hud-stdin-cache.json` — last statusLine input per session (v5.8.6). The session id comes from `CLAUDE_SESSION_ID` or `CLAUDECODE_SESSION_ID`, else from the stdin field `session_id`; only without a valid one does the input go to the flat `<git root>/.omc/state/hud-stdin-cache.json` (the v5.6.2 path, shared by every session of the project). Outside a git repository the `.omc/state/` root is the nearest directory holding an `.omc-workspace` marker, else `~/.omc/state/` (v5.0.0 wrote it into the current directory).
- `~/.claude/.omc/hud-account-cache.json` (under `$CLAUDE_CONFIG_DIR` when set) — written only while the opt-in account segment is on (see Side effects).
- `$CLAUDE_CONFIG_DIR/.omj-hud-cache/` — wrapper cache (`statusline.<key>.txt`, `stdin.<key>.json`, `stderr.<key>.log`, in-flight `statusline.<key>.<pid>.tmp|.err` and `stdin.<pid>.tmp`, `render.<key>.lock/`, `sweep.stamp`, `sweep.lock/`). The 7-day TTL also covers the temp files and `stderr.*.log`.

## Side effects (audited at v5.8.6)

Audited by diffing the bundled source modules between v5.6.2 and v5.8.6 for network calls, spawned processes, file writes, environment reads, and runtime imports. Network endpoints, spawned commands, and runtime imports are the same as at v5.6.2; the new items are marked v5.8.6.

- Network: `api.anthropic.com/api/oauth/usage` for the rate-limit segment and `platform.claude.com/v1/oauth/token` to refresh an expired token. New in v5.6.2: when the usage endpoint answers 403, the bundle sends a one-token `claude-haiku-4-5` request to `api.anthropic.com/v1/messages` with the same OAuth token and reads the rate-limit headers. While the 403 persists the probe repeats once per usage poll window (default 90 s; about every 2 minutes once the probe also fails), and each probe is a billed model request against the subscription. Provider usage endpoints are called only when `ANTHROPIC_BASE_URL` points at z.ai, MiniMax, or Kimi. The GitHub release URLs in the bundle have no call site. Setting `"omcHud": { "elements": { "rateLimits": false } }` in `~/.claude/settings.json` skips all of these.
- Credentials: `CLAUDE_CODE_OAUTH_TOKEN` (new in v5.6.2, checked first), then the macOS Keychain item `Claude Code-credentials` (suffixed with a hash of `CLAUDE_CONFIG_DIR` when set) via `/usr/bin/security`, then `$CLAUDE_CONFIG_DIR/.credentials.json`. A refreshed token is written back to the source it came from. Unless `CLAUDE_CODE_OAUTH_TOKEN` is set, stored credentials are read on every render for the subscription tier, whatever `rateLimits` says; only the network calls and the token refresh sit behind `rateLimits`. New in v5.8.6: a read of stored credentials (Keychain or `.credentials.json`) whose record carries no account UUID also reads the `oauthAccount` entry of `.claude.json` in the config directory and in the directory above it (`~/.claude.json` for the default `~/.claude`) to tie cached quota to the signed-in account, and a token record written back after a refresh also gets `omcUsageProfileId` and `omcUsageProfileTokenHash`, SHA-256 hashes of the account identity and of the token.
- Account segment (v5.8.6, opt-in, off in every preset; this copy leaves it off): with `"omcHud": { "elements": { "account": true } }` the HUD shows the signed-in email. It reads `.claude.json` in `$CLAUDE_CONFIG_DIR` (default `~/.claude`), then `~/.claude.json`, opened without following symlinks, and writes the email with those files' size, mtime, and inode to `hud-account-cache.json` (see the state paths). Nothing is shown when signed out or when auth comes from `ANTHROPIC_API_KEY`.
- Processes: `git`, `/usr/bin/security`, `node scripts/session-summary.mjs` (which runs `claude -p`; only with the opt-in `sessionSummary` element), and the command of a custom rate provider when one is configured.
- Imports outside the bundle: new in v5.6.2, `better-sqlite3` is required at load through `createRequire`, resolved from the install directory upward; when it is absent the bundle silently uses its file-lock fallback.

## Known limitations

- Codex uses its native CLI footer instead of this bundle. Model, branch, context, and quota indicators are configured user-globally through `[tui].status_line` in `$CODEX_HOME/config.toml` (default `~/.codex/config.toml`), preserving project overrides; see [Codex setup](../docs/CODEX-SETUP.md). Codex App has no documented custom HUD slot. The shared answer style is available separately through project instructions.

- Version label reads the first `package.json` with a `name` and `version` up to five levels above the bundle. From a checkout it shows the oh-my-joy version with an `L` (local) suffix. For the installed copy those levels reach `~/.claude`, `~`, and the directory above the home directory, so a `package.json` there shows an unrelated version (and can enable the update hint below); without one the label is plain `[OMJ]`.
- The diagnostic printed when the bundle runs without stdin checks `$CLAUDE_CONFIG_DIR/omj-hud/omj-hud.mjs`, while setup installs to `~/.claude/omj-hud/`; with `CLAUDE_CONFIG_DIR` set elsewhere it reports the script `MISSING` even though the statusLine works.
- A render whose lock was reclaimed past `OMJ_HUD_LOCK_MAX_SECONDS` keeps running; when it finishes it still writes its output and, on a clean success, clears `stderr.<key>.log`. It cannot remove the new owner's lock.
- `OMC_*` env vars (`OMC_DEBUG`, `OMC_STATE_DIR`, …) inside the bundle keep their upstream names.
- Strings outside the rebrand list keep their upstream names. Three upstream messages new in v5.6.2 and still present at v5.8.6: the error `Cannot resolve a safe non-git OMC state root` (only when the home directory resolves to the filesystem root), the `npm rebuild better-sqlite3` remediation that names the upstream plugin directory (only when `better-sqlite3` is installed but its native binding fails to load), and the `[!] omc <version> - paste: …` update hint with the upstream install command (only where the version label resolves — a checkout, or an installed copy with a `package.json` in `~/.claude` or `~` — with an update-check cache that names a newer version). The stored credential field names `omcUsageProfileId` and `omcUsageProfileTokenHash` (v5.8.6) also stay, so a record written here matches the one an upstream HUD writes to the same Keychain item or `.credentials.json`; only the module-local constants that hold them are renamed.

## Regenerating the bundle

The release tag ships no `dist/`, so build it first with the TypeScript and esbuild versions the tag's `package-lock.json` pins (5.9.3 and 0.27.2 at v5.8.6). Bundle from the directory that holds the checkout, so the bundle's path comments read `v5.8.6/dist/...`:

```sh
cd <build-dir>
git clone https://github.com/Yeachan-Heo/oh-my-claudecode.git upstream
git -C upstream worktree add --detach ../v5.8.6 v5.8.6
(cd v5.8.6 && npm ci --ignore-scripts && npx tsc)
v5.8.6/node_modules/.bin/esbuild v5.8.6/dist/hud/index.js --bundle --platform=node --format=esm \
  --outfile=<oh-my-joy>/hud/vendor/hud/index.js
```

Then apply the rebrand list, each string occurring once. The list is the full set of lines that differ between a fresh upstream bundle and the committed one, path comments aside; re-derive it by diffing the previous release's fresh bundle against the committed file before applying it to a new release. At v5.8.6 a fresh v5.6.2 bundle differed from the committed one on the first 11 rows exactly; the last 6 rows are new in v5.8.6, where the check grep below matched `[OMC_USAGE_PROFILE_…]`.

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
| `var OMC_USAGE_PROFILE_ID_FIELD = ` | `var OMJ_USAGE_PROFILE_ID_FIELD = ` — module-local constant; its value `"omcUsageProfileId"` stays |
| `var OMC_USAGE_PROFILE_TOKEN_HASH_FIELD = ` | `var OMJ_USAGE_PROFILE_TOKEN_HASH_FIELD = ` — value `"omcUsageProfileTokenHash"` stays |
| `credentials[OMC_USAGE_PROFILE_ID_FIELD]` | `credentials[OMJ_USAGE_PROFILE_ID_FIELD]` |
| `credentials[OMC_USAGE_PROFILE_TOKEN_HASH_FIELD]` | `credentials[OMJ_USAGE_PROFILE_TOKEN_HASH_FIELD]` |
| `record[OMC_USAGE_PROFILE_ID_FIELD]` | `record[OMJ_USAGE_PROFILE_ID_FIELD]` |
| `record[OMC_USAGE_PROFILE_TOKEN_HASH_FIELD]` | `record[OMJ_USAGE_PROFILE_TOKEN_HASH_FIELD]` |

Check: `grep -nE '\[OMC|omc update|/oh-my-claudecode:|omc-hud' hud/vendor/hud/index.js` prints nothing, and a fresh bundle diffs against the committed one on these 17 lines only.

OMJ-local changes to keep when re-porting `omj-hud-cache.sh` (`tests/hud-cache-wrapper.test.mjs` pins the render pid, the lock age ceiling, the stderr log, and the live-pid skip; the non-numeric fallback and the TTL patterns are not pinned; the same file pins the loader's load-failure line, the effort segment, and the per-session stdin cache):

- Real render pid: `refresh_cache` takes `REFRESH_PID` from a child's `PPID` (not `$$`, which in the background subshell is the exiting wrapper) and names its temp files and lock pid with it.
- Pid-based sweep: temp and `.err` files are skipped while the pid field before their extension is alive; a non-numeric field uses the age rule alone; the TTL `find` also covers them.
- Lock age ceiling: `OMJ_HUD_LOCK_MAX_SECONDS` (default 300) reclaims a lock even when its pid is alive.
- stderr log: non-empty render stderr moves to `stderr.<key>.log`; a later stderr-free successful render removes it.
