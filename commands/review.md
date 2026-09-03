---
description: Review the changed diff and report only — frontend files against the frontend-fundamentals 4 criteria + a11y · Figma fidelity · vercel · Next.js (Context7); every other file against correctness, simplicity, consistency with surrounding code, and test coverage. Canonical invocation is /oh-my-joy:review
argument-hint: "[--base <ref>]"
allowed-tools: Read, Grep, Glob, Skill, Bash(git diff:*), Bash(git rev-parse:*), mcp__plugin_context7-plugin_context7__*, mcp__context7__*
---

# /oh-my-joy:review — Code review of the diff (report only)

Read the changed code and produce a severity-graded report. Fixing belongs to `/oh-my-joy:fix` (visual defects) or to a normal edit; a reviewer that also edits cannot be trusted as a reviewer, which is why this command declares no `Write`/`Edit`.

The diff comes from `git diff`, which is read-only and works in Plan mode on current Claude Code (Plan mode blocks writes and side-effect Bash only). If your environment blocks Bash entirely in Plan mode, run this outside it.

## Arguments

- (none) — the working tree's uncommitted plus staged changes: `git diff HEAD`.
- `--base <ref>` — the whole branch against a base: `git diff <ref>...HEAD`, for example `--base main`.

## Preflight

1. `git rev-parse --is-inside-work-tree` — if it fails, say "not a git repository — nothing to review" and stop.
2. Collect the diff per the arguments. With no arguments and an empty `git diff HEAD`, also check `git diff --cached`. An empty diff ends with "no changes — nothing to review".
3. Sort the changed files into two classes. Frontend: `.tsx`/`.jsx`/`.ts`/`.css`/`.scss` plus anything under components, hooks, or styles directories. Everything else is general. Both classes are reviewed; a diff with no frontend files is still a review target.

## Procedure

1. Load the rubric by invoking the `frontend-fundamentals` skill via `Skill` and use its `references/` (readability, predictability, cohesion, coupling, a11y) plus its routing rules. If the skill cannot be loaded, apply the four criteria by name and note "FF skill not loaded — abridged rubric".
2. If an approved spec from `/oh-my-joy:spec` or `/oh-my-joy:deep-interview` is in the session context, read its acceptance criteria first and check each one against the diff. Unmet criteria are findings at 🟡 or higher; this is how the plan's promises get verified rather than forgotten.
3. Review each changed file. When cohesion or coupling cannot be judged from a hunk alone, `Read` the full file and check related symbols with `Grep`/`Glob`, so a fragment never causes a misjudgment.
   - Frontend files: the four criteria and accessibility (alt, semantics, keyboard, touch targets); token deviations (raw hex, direct primitive use); Figma fidelity per `references/figma-fidelity.md` (changed original text, invented variants, fixed px widths, hardcoded tokens); performance and composition per the `vercel-react-best-practices` and `vercel-composition-patterns` skills when installed; Next.js version-sensitive topics (App Router, Server/Client boundary, `fetch` caching, `metadata`, `Image`, middleware, `next/dynamic`) checked against the current `/vercel/next.js` docs via Context7. A missing layer is skipped, as the FF skill's routing rules describe.
   - General files: correctness (edge cases, error paths, off-by-one, concurrency), simplicity (dead branches, needless abstraction, duplicated logic that already exists nearby), consistency with the surrounding code's conventions, and test coverage (did the change touch or add the tests it needs).

## Output

Group findings by severity: 🔴 blocker (behavioral or accessibility defects, unmet acceptance criteria that break the goal), 🟡 major (principle violations, performance, missing tests), 🟢 minor or nit (style). Each item reads `file:line + the violated principle + the recommended fix`. Close with counts per severity, "fix blockers and majors first; minors can move to a follow-up", and the next step in the flow: `/oh-my-joy:verify <route>` for frontend work, `/oh-my-joy:verify` (evidence mode) otherwise.

## Usage

<example>
```
/oh-my-joy:review                  review the working tree's uncommitted + staged changes
/oh-my-joy:review --base main      review the whole branch against main
/oh-my-joy:review --base origin/main
```
</example>
