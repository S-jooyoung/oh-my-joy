---
description: Ship the finished work — run the project's verification commands (every one must exit 0), commit on a branch with the project's conventions, push, and open the PR with the evidence attached. The last step of every OMJ flow; review and verify are yours to run first (run outside Plan mode). Canonical invocation is /oh-my-joy:ship
argument-hint: "[\"PR title\"] [--base <ref>]"
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git checkout -b:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git log:*), Bash(gh auth status:*), Bash(gh pr create:*), Bash(npx tsc:*)
---

# /oh-my-joy:ship — Prove, commit, push, open the PR

Take work that review and verification have already covered and put it in front of others: verification commands first, then a commit that follows the project's conventions, a push, and a pull request whose body carries the evidence. This is the one command that leaves the machine, so it stays a step you run yourself rather than part of the automatic completion procedure.

Verification commands (`npm test` and friends) are not pre-approved here. Each one raises a permission prompt, and that prompt is what makes the recorded evidence trustworthy — pre-approving a project's scripts would turn a narrow grant into arbitrary execution. Only `git`, `gh`, and `npx tsc` are pre-approved.

## Arguments

- `["PR title"]` — the pull request title. Without it, derive one from the commit subject.
- `--base <ref>` — the PR base branch (default: the repository's default branch).

## Procedure

1. Confirm there is something to ship: `git status` and `git diff`. With no changes and no unpushed commits, say so and stop.
2. Discover the verification commands in this order and stop at the first source that yields any: the approved spec's "Verification commands" in session context; `verifyCommands:` in `.omj/fe-context.md`; `package.json` scripts named `typecheck`, `lint`, and `test` (TypeScript projects with none of these fall back to `npx tsc --noEmit`). If nothing is found, print "no verification command declared — add `verifyCommands:` to `.omj/fe-context.md` or a `test` script" and stop. Shipping without any proof is the failure mode this command exists to prevent.
3. Run every discovered command and collect evidence per command: the command line, its exit code, and a one-line summary. Any non-zero exit ends the run with the evidence table and no commit; fix the failure, then ship again.
4. Branch: read the current branch with `git rev-parse --abbrev-ref HEAD` and `git branch --show-current`. On the default branch, create a branch first with `git checkout -b <type>/<short-slug>` — the repository's own rule may be "no direct commits to main", and a PR needs a branch anyway.
5. Commit. Follow the project's commit conventions, including language, read from `git log` and any contributing guide. Stage only the files this work changed, by explicit path with `git add <path> …`; `git add -A` would sweep in unrelated working-tree changes. Then `git commit` with a subject that says what changed and a body that says why. No AI signatures or `Co-Authored-By` trailers, and no `--no-verify`: pre-commit hooks are the project's gate, not an obstacle.
6. `git push -u origin <branch>`.
7. Open the PR: check `gh auth status`, then `gh pr create --title "<title>" --base <ref> --body "<body>"` with the body in this shape — Summary, Changes, Test plan — where Test plan carries the evidence table from step 3 and, when review or verify reports exist in the session, a two-line summary of each. If `gh` is missing or unauthenticated, print the compare URL from the push output instead and stop; the push already happened.

## Output

The evidence table (command · exit code · summary), the commit hash, the branch, and the PR URL. When step 3 fails, the same table with the failing rows first and no commit.

## Usage

<example>
```
/oh-my-joy:ship "feat(checkout): implement the checkout sections"
/oh-my-joy:ship                              derive the title from the commit subject
/oh-my-joy:ship "fix: rate-limit off-by-one" --base develop
```
</example>
