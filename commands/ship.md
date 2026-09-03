---
description: Ship the finished work — run the project's verification commands (every one must exit 0), commit on a branch with the project's conventions and language, push, and open the PR with the evidence attached. Asks one question when --base is not given (which branch the PR targets); never commits directly on a shared branch. The last step of every OMJ flow; review and verify are yours to run first (run outside Plan mode). Canonical invocation is /oh-my-joy:ship
argument-hint: "[\"PR title\"] [--base <ref>]"
allowed-tools: Read, Grep, Glob, AskUserQuestion, Bash(git status:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git checkout -b:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git log:*), Bash(gh auth status:*), Bash(gh pr create:*), Bash(npx tsc:*)
---

# /oh-my-joy:ship — Prove, commit, push, open the PR

Take work that review and verification have already covered and put it in front of others: verification commands first, then a commit that follows the project's conventions, a push, and a pull request whose body carries the evidence. This is the one command that leaves the machine, so it stays a step you run yourself rather than part of the automatic completion procedure. You write nothing by hand: the commit message, the PR title, and the PR body are composed from the work and the project's own conventions.

Verification commands (`npm test` and friends) are not pre-approved here. Each one raises a permission prompt, and that prompt is what makes the recorded evidence trustworthy — pre-approving a project's scripts would turn a narrow grant into arbitrary execution. Only `git`, `gh`, and `npx tsc` are pre-approved.

## Arguments

- `["PR title"]` — the pull request title. Without it, derive one from the commit subject.
- `--base <ref>` — the branch the PR targets. Without it, ship asks once which branch to open the PR against (its only question); teams that always target `develop` pass `--base develop` and are never asked.

## Shared branches

A shared branch is one people merge into rather than commit on: the repository's default branch (`git rev-parse --abbrev-ref origin/HEAD`, falling back to `main`) and the conventional integration names `main`, `master`, `develop`, `dev`, `trunk`, `staging`, and `release/*`. Ship never commits on one of these directly; it branches off first. The names are only a safety net — the PR target itself always comes from `--base` or the question below, so a team can use any branch name.

## Procedure

1. Work out what there is to ship: `git status` and `git diff`, plus the current branch from `git rev-parse --abbrev-ref HEAD` (or `git branch --show-current`). Three situations:
   - Changes to commit → the normal path (steps 2–7).
   - A clean tree on a shared branch → the promotion path: nothing to commit, the branch itself becomes the PR (for example `develop` → `main` for a release). Steps 2–3 still run, because a release deserves the same proof; steps 4–5 are skipped.
   - A clean tree on a feature branch with nothing unpushed, or a clean shared branch that turns out to be the base itself → say "nothing to ship" and stop.
2. Discover the verification commands in this order and stop at the first source that yields any: the approved spec's "Verification commands" in session context; `verifyCommands:` in `.omj/fe-context.md`; `package.json` scripts named `typecheck`, `lint`, and `test` (TypeScript projects with none of these fall back to `npx tsc --noEmit`). If nothing is found, print "no verification command declared — add `verifyCommands:` to `.omj/fe-context.md` or a `test` script" and stop. Shipping without any proof is the failure mode this command exists to prevent.
3. Run every discovered command and collect evidence per command: the command line, its exit code, and a one-line summary. Any non-zero exit ends the run with the evidence table and no commit; fix the failure, then ship again.
4. Branch. On a shared branch with changes, create a branch first with `git checkout -b <type>/<short-slug>` and remember the branch you left — it is the natural PR target and becomes option 1 of the question in step 7. On a feature branch, stay where you are.
5. Commit. Read the project's conventions from `git log` and any contributing guide and follow them, including the language: a repository whose recent commits are in Korean gets a Korean commit message. Subject says what changed, body says why. Stage only the files this work changed, by explicit path with `git add <path> …`; `git add -A` would sweep in unrelated working-tree changes. Then `git commit`. No AI signatures or `Co-Authored-By` trailers, and no `--no-verify`: pre-commit hooks are the project's gate, not an obstacle.
6. `git push -u origin <branch>`.
7. Choose the base and open the PR. With `--base`, use it. Without it, ask exactly once via `AskUserQuestion` — "Open the PR against which branch?" — with options drawn from `git branch -r`: the shared branches that actually exist on the remote (at most four; anything else goes through the free-text answer), never the current branch. Option 1 is the shared branch you branched off in step 4 when there was one, otherwise the default branch. This is the only decision the command cannot make from a rule, because the right target differs per repository and per PR (feature → `develop`, release → `main`), and the answer sends work to other people. Then check `gh auth status` and run `gh pr create --title "<title>" --base <ref> --body "<body>"`. The body follows the repository's `.github/PULL_REQUEST_TEMPLATE.md` when one exists — fill its headings, tick only the checkboxes that are actually true — and otherwise uses Summary / Changes / Test plan with those three headings written in the same language as the commit (a Korean repository gets Korean headings). Test plan always carries the evidence table from step 3, with column names in that language, and a two-line summary of any review or verify report from the session. If `gh` is missing or unauthenticated, print the compare URL from the push output and stop; the push already happened.

## Output

The evidence table (command · exit code · summary), the commit hash (or "promotion — no commit"), the branch, the base with how it was chosen (`Base: develop (--base)` or `Base: develop (asked)`), and the PR URL. When step 3 fails, the same table with the failing rows first and no commit.

## Usage

<example>
```
/oh-my-joy:ship "feat(checkout): implement the checkout sections" --base develop   feature branch → develop, no question
/oh-my-joy:ship                                                                     derive the title from the commit subject; ask for the base
/oh-my-joy:ship "release: 2026-09 week 3" --base main                               run on a clean develop → promotion PR develop → main
/oh-my-joy:ship "fix: rate-limit off-by-one"                                       run on develop with changes → branches off first, then asks for the base
```
</example>
