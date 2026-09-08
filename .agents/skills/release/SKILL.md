---
name: release
description: Use when an OMJ maintainer asks to cut, prepare, or ship a repository release through the release PR, CI, automatic tag/Release, integrity readback, and installed-host refresh.
---

# OMJ release

Read [the shared release contract](../../../docs/RELEASING.md) completely and execute the requested release scope. This is a repository-local maintainer skill discovered from `.agents/skills/`; it is not registered in the OMJ plugin workflow list.

## Codex adapter

- Use native structured input only when the shared contract reaches a concrete publication decision and the user has not already authorized it. Clear cut-and-ship intent is existing authorization; `--pr-only` stops after PR readback.
- Use `apply_patch` only for an explicitly requested prose correction. The deterministic release cut must run through `node scripts/release.mjs`; never hand-edit version surfaces.
- Stage the five exact release paths, never broad staging. Do not commit on `main`, force-push, manually tag, or merge before registered required checks pass.
- Use the exact Codex CLI supported by this repository's verified target: `codex plugin marketplace upgrade omj --json`, `codex plugin add oh-my-joy@omj --json`, and `codex plugin list --marketplace omj --json`. There is no Codex `plugin install` or `plugin update` subcommand.
- Refresh only already-installed hosts. Resolve cache paths from host readback, compare their inventory hash to the GitHub Release hash, and require a new session/restart readback for changed surfaces.

Persist until every authorized release step has evidence or a real blocker remains. Report the exact PR, merge SHA, workflow, tag target, Release hash, and per-host cache proof.
