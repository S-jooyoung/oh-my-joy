---
name: ship
description: Verify finished work, commit it safely on a feature branch, push, and open a pull request with evidence. Use only when the user explicitly asks to ship, push, or create the PR; never infer shipping intent from completed code.
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Ship verified work

Turn finished local work into a reviewed pull-request boundary: verify first, then commit, push, and open the PR. This skill performs external actions and must not activate merely because implementation is complete. Require an explicit current request to ship, push, or create the PR.

Accept an optional PR title and `--base <ref>`. A direct `$oh-my-joy:ship` invocation is explicit shipping intent. If the request mentions shipping only hypothetically, discusses this skill, or asks for a dry run, stay read-only.

## Safety boundaries

- Never commit directly on a shared branch. Shared branches include the remote default branch, `main`, `master`, `develop`, `dev`, `trunk`, `staging`, and `release/*`.
- Never stage unrelated changes. Use explicit file paths; never `git add .` or `git add -A`.
- Never bypass hooks, add AI signatures, or add `Co-Authored-By` trailers.
- Never push, create a PR, or otherwise mutate a remote unless the current request explicitly authorizes shipping. If authorization covers only one external action, stop after that action.
- Never force-push, overwrite an existing remote branch, merge, release, or deploy unless separately and explicitly requested.

## Inspect the shipping state

Read repository instructions, `git status`, the working-tree diff, the current branch, remote default branch, remote branches, upstream status, and recent commit conventions.

Handle these states:

- Changes on a feature branch: verify, commit, push, open PR.
- Changes on a shared branch: verify, create a new feature branch, then commit. Do not make the commit before branching.
- Clean feature branch with unpushed commits: verify, push, open PR.
- Clean shared branch used as a promotion source: only continue when the user explicitly asked for a promotion PR and the requested base differs from the source branch.
- Nothing changed or unpushed: report "nothing to ship" and stop.

If the working tree contains changes outside the current task and their ownership cannot be established, exclude them. If the requested work cannot be isolated safely, stop before staging and report the exact overlap.

## Verify before mutation

Discover verification commands from the first source that provides them:

1. an approved ralplan in current session context,
2. `verifyCommands:` in `.omj/fe-context.md`,
3. `package.json` scripts named `typecheck`, `lint`, and `test`,
4. `npx tsc --noEmit` for a TypeScript project with none of those scripts.

If no verification command can be found, stop before branching, committing, or pushing and explain how to declare one. Run every discovered command and record command, exit code, and a one-line summary. Any non-zero exit stops shipping before all git mutations; fix only when the user also asked for fixes, otherwise report the failure.

## Branch and commit

On a shared branch with changes, create a uniquely named `<type>/<short-slug>` branch based on repository conventions. On a feature branch, remain there. Read recent history and contribution instructions to match commit language and format. Compose a subject describing what changed and a body explaining why, then stage only the task-owned files and commit normally.

Inspect the resulting commit and tree before any remote action. If hooks changed files, review those changes, rerun affected verification, and amend only when the user's shipping request includes the commit and the amended content remains in scope.

## Push and open the PR

Use the provided `--base` when present. Otherwise select a base only when it is unambiguous from the branch the work left or repository conventions; if multiple real remote targets remain plausible, ask one concise structured question using existing remote shared branches, excluding the current branch.

Push the current feature branch with upstream tracking. Do not push a shared branch as the implementation branch. Check GitHub CLI authentication before creating the PR; an unavailable or unauthenticated CLI ends the workflow after push with a compare URL when available.

Build the PR title from the explicit title or commit subject. Preserve `.github/PULL_REQUEST_TEMPLATE.md` when present and mark only true checkboxes. Otherwise use Summary, Changes, and Test plan headings in the repository's commit language. Include the verification evidence and a concise review/visual-verification summary when available. Create the PR against the selected base, then read back the resulting URL and visible title/body when the tooling supports it.

## Result

Report the verification evidence table, commit hash or promotion status, source branch, base and how it was selected, push result, and PR URL. Never claim shipping completed when verification, push, or PR creation did not complete.
