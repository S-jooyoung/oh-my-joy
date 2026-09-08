---
description: Cut and ship an OMJ release through its release PR, green CI, automatic tag/GitHub Release, integrity readback, and refresh of already-installed Claude/Codex hosts. Repo-local maintainer command; not registered as a plugin workflow
argument-hint: "[--version X.Y.Z | --bump patch|minor|major] [--pr-only]"
allowed-tools: Read, AskUserQuestion, Bash(git status:*), Bash(git switch:*), Bash(git checkout:*), Bash(git pull:*), Bash(git rev-parse:*), Bash(git diff:*), Bash(git log:*), Bash(git ls-remote:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(node scripts/release.mjs:*), Bash(node scripts/generate-inventory.mjs:*), Bash(npm test:*), Bash(npm run validate-plugin:*), Bash(npm run eval:*), Bash(gh auth status:*), Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh pr merge:*), Bash(gh run list:*), Bash(gh run view:*), Bash(gh run watch:*), Bash(gh workflow run:*), Bash(gh release view:*), Bash(claude plugin marketplace update:*), Bash(claude plugin update:*), Bash(claude plugin list:*), Bash(claude plugin details:*), Bash(codex plugin marketplace upgrade:*), Bash(codex plugin add:*), Bash(codex plugin list:*)
---

# /release — OMJ maintainer release

Read [the shared release contract](../../docs/RELEASING.md) completely and execute it for `$ARGUMENTS`. The shared document owns version selection, cut scope, validation, release review, authority, PR/CI/merge/tag readback, content-hash verification, and installed-host refresh. Do not replace it with remembered behavior or the older checklist wording.

## Claude adapter

- Use `AskUserQuestion` only at the shared contract's concrete publication decision when the user's request did not already authorize it. `/release` with clear cut-and-ship intent is existing authorization; do not ask again. `--pr-only` is an explicit stop.
- Stage only the five release-cut paths named in the shared contract. Never use `git add -A` or `git add .`, never commit on `main`, never force-push, and never create or move a tag manually.
- Treat “no checks reported” as pending. Merge only after checks appear and all required checks pass.
- Refresh Claude Code and Codex only when each is already installed. Use each host's own commands and metadata; never infer installed contents from version equality.
- Keep exact PR, merge commit, workflow run, tag/Release, content hash, cache inventory, and restart/new-session readbacks for the report.

On a failure, stop at the contract's boundary and preserve the release branch for inspection. Do not broaden the release to fix unrelated work unless the user explicitly adds that scope.

<example>

```text
/release
/release --bump minor
/release --version 1.0.0
/release --pr-only
```

</example>
