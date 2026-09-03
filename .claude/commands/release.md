---
description: Cut and ship an OMJ release in one go — pick the next version from the CHANGELOG, run the cut, open the release PR, wait for CI, merge, wait for the tag and GitHub Release, and apply the new version to this machine. Repo-local maintainer command; not part of the plugin
argument-hint: "[--version X.Y.Z | --bump patch|minor|major] [--pr-only]"
allowed-tools: Read, AskUserQuestion, Bash(git status:*), Bash(git checkout:*), Bash(git pull:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(node scripts/release.mjs:*), Bash(npm test:*), Bash(npm run validate-plugin:*), Bash(gh auth status:*), Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh pr merge:*), Bash(gh run list:*), Bash(gh run watch:*), Bash(gh release view:*), Bash(claude plugin marketplace update:*), Bash(claude plugin update:*), Bash(claude plugin list:*)
---

# /release — one-command OMJ release

Take everything that has accumulated under `[Unreleased]` and turn it into a deployed version: cut, PR, CI, merge, tag, and the local apply, with one confirmation in the middle. This is a maintainer command that lives in `.claude/commands/` of this repository; it is not shipped with the plugin, because release mechanics are specific to this repo.

Why a merge is not a release: the plugin's `version` string is the deployment gate. Feature PRs merge into main without changing it, so nothing reaches installed users until a cut PR bumps the four version surfaces and lands on main; from that moment `release-tag.yml` attaches the tag and publishes the GitHub Release on its own. This command does the human half of that and waits for the automatic half.

## Arguments

- `--version X.Y.Z` — the version to cut. Without it, `node scripts/release.mjs next` infers it from `[Unreleased]`: removals, changes, or deprecations make a minor bump, additions and fixes alone make a patch; a major bump is never inferred.
- `--bump patch|minor|major` — override the inference without naming the number.
- `--pr-only` — stop after the release PR is open; skip the confirmation, the merge, and the local apply.

## Procedure

1. Preflight. Run from the repository root with a clean tree (`git status --porcelain` prints nothing) and an authenticated `gh` (`gh auth status`). Anything else stops here with the reason — a dirty tree would be swept into the release commit, and an unauthenticated `gh` fails at the PR step after the cut has already been made.
2. Start from main: `git checkout main && git pull --ff-only`.
3. Decide the version: `--version` if given, otherwise `node scripts/release.mjs next` (with `--bump` when passed). Call it X.Y.Z from here on.
4. Cut on a release branch: `git checkout -b release/vX.Y.Z`, then `node scripts/release.mjs cut --version X.Y.Z`, then `npm test` and `npm run validate-plugin`. If the cut or a gate fails, leave the branch and the diff in place, print the failure, and stop — the maintainer either fixes the prose (the script never summarizes) or discards the branch. Never edit a version string by hand.
5. Summarize what is about to ship: the version, the entry count per CHANGELOG section (read the new `## [X.Y.Z]` section from `CHANGELOG.md`), and `git diff --stat`. Then, unless `--pr-only`, ask exactly one `AskUserQuestion`: "vX.Y.Z — merge and deploy now (recommended) / open the PR only / abort". This is the one consent point: everything after it is visible to other people and hard to undo. Abort leaves the branch for inspection.
6. Commit and open the PR: `git add -A`, `git commit -m "chore(release): vX.Y.Z"` (no AI signatures), `git push -u origin release/vX.Y.Z`, then `gh pr create --title "chore(release): vX.Y.Z" --body "Release cut — on merge, release-tag.yml attaches the tag and GitHub Release automatically." --assignee S-jooyoung --label chore`. With `--pr-only` or "open the PR only", print the PR URL and stop.
7. Merge and wait for the automatic half. `gh pr checks <n> --watch` blocks until CI finishes; on any failure print the PR URL and the failing job link and stop without merging. On green, `gh pr merge <n> --squash --delete-branch`, then read the merge commit with `gh pr view <n> --json mergeCommit`. Poll `gh run list --workflow release-tag.yml --branch main --limit 3 --json databaseId,headSha,status` until a run for that commit appears (it starts within seconds of the push), then `gh run watch <id> --exit-status`. If that run fails, report that the tag or Release was not published and point to a manual `workflow_dispatch` re-run of `release-tag.yml`; never create the tag by hand, because a tag off main is the incident that made tagging automatic. On success, `gh release view vX.Y.Z --json url,body` and keep the URL and the `Content hash` line.
8. Apply locally. `git checkout main && git pull --ff-only`. `Read` `~/.claude/plugins/known_marketplaces.json`: when the `omj` source is a `directory` pointing at this clone, the pull is the deployment and the metadata must be re-read explicitly — run `claude plugin marketplace update omj`, then `claude plugin update oh-my-joy@omj`; with any other source, run the same two commands (they fetch from the published marketplace). Then the drift check: the repo version (`.claude-plugin/plugin.json`), the installed version (`~/.claude/plugins/installed_plugins.json`, entry `oh-my-joy@omj`), `git log -1 --format=%cI`, and the marketplace `lastUpdated` from the same JSON. Repo and installed versions equal, and lastUpdated at or after HEAD, means the machine is current; otherwise say which value lags and the fix (`claude plugin list` confirms what is installed).
9. Report: the version, the PR URL, the Release URL, the Content hash, the installed version, and the one thing left to do by hand — restart Claude Code, because plugin components are not hot-swapped inside a running session.

## Output

```md
## Release vX.Y.Z
- PR: <url> (merged)
- Release: <url> · Content hash: <sha256>
- Installed: X.Y.Z (repo X.Y.Z, marketplace re-read at <time>)
- Next: restart Claude Code
```

## Usage

<example>
```
/release                       infer the version from [Unreleased], cut, PR, merge, tag, apply
/release --bump minor          force a minor bump
/release --version 1.0.0       an explicit version (the only way to go major)
/release --pr-only             stop after the release PR is open
```
</example>

The manual procedure this command automates, and the drift check it runs at the end, are written out in `CONTRIBUTING.md` ("Releases") and the repo-local `release-checklist` skill.
