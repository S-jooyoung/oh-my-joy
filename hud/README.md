# OMJ HUD

Claude Code statusLine HUD, vendored from [oh-my-claudecode](https://github.com/anthropics-community/oh-my-claudecode) v5.0.0 `dist/hud` (MIT, © 2025 Yeachan Heo — see `NOTICE.md`). Installed by `/oh-my-joy:setup` as a copy at `~/.claude/omj-hud/` with:

```json
"statusLine": { "type": "command", "command": "sh ~/.claude/omj-hud/omj-hud-cache.sh ~/.claude/omj-hud/omj-hud.mjs" }
```

## Layout

- `omj-hud-cache.sh` — POSIX cache wrapper (hot path: cat last render; background refresh). Cache dir: `$CLAUDE_CONFIG_DIR/.omj-hud-cache/` (override: `OMJ_HUD_CACHE_DIR`).
- `omj-hud.mjs` — loader; imports the vendored bundle (which runs `main()` on import).
- `vendor/hud/index.js` — esbuild bundle of upstream `dist/hud/index.js` (display strings rebranded OMC→OMJ; logic untouched).
- `scripts/session-summary.mjs` — standalone session-summary generator, spawned by the bundle via `vendor/hud/../../scripts/` (missing = graceful skip).
- `find-node.sh` — node resolver for non-interactive shells (nvm/fnm/volta/brew fallbacks).

## HUD-owned state (legacy paths kept, no bundle patch)

- `~/.claude/.omc/hud-config.json` — HUD element config (optional).
- `~/.claude/.omc/update-check.json` — if present, renders an "update" segment; safe to delete.
- `~/.claude/plugins/oh-my-claudecode/.usage-cache*.json` — usage API cache, recreated automatically.

## Known limitations

- Version label reads the nearest `package.json` up the tree (shows the oh-my-joy version when run from the copy layout).
- `OMC_*` env vars (`OMC_DEBUG`, `OMC_STATE_DIR`, …) inside the bundle keep their upstream names.

## Regenerating the bundle

```sh
npx esbuild <oh-my-claudecode>/dist/hud/index.js --bundle --platform=node --format=esm \
  --outfile=hud/vendor/hud/index.js
# then re-apply the OMC→OMJ display-string rebrand (grep -n '\[OMC' to find them)
```
