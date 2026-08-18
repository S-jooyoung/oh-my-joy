---
description: Integrated review of a branch/staged diff against the FF 4 criteria + a11y · vercel (performance/composition) · Next.js (Context7) (read-only). Canonical invocation is /oh-my-joy:ff-review
argument-hint: "[--base <ref>]"
allowed-tools: Read, Grep, Glob, Skill, Bash(git diff:*), Bash(git rev-parse:*), mcp__plugin_context7-plugin_context7__*, mcp__context7__*
---

# /oh-my-joy:ff-review — FF integrated code review (verification, read-only)

Reviews changed frontend code (the diff) in one pass against the **frontend-fundamentals 4 criteria + accessibility**, **vercel performance/composition**, and **Next.js (Context7) latest recommendations**, and produces a **severity-graded report only**. **It fixes nothing.**

> ✅ **Read-only verification — it does not modify (by capability).** With no `Write`/`Edit` in allowed-tools, it never touches code and, like a linter, **only reports**. To fix findings, hand off to `/oh-my-joy:fix` (the active loop) or manual edits.
>
> ⚠️ **Reads the diff via Bash(git).** `git diff`/`git rev-parse` are **read-only** and generally work as is even in current Claude Code Plan mode (Plan mode blocks `Write`/`Edit` and side-effect Bash only; read-only Bash is allowed). If your environment's Plan mode blocks Bash entirely, exit Plan mode before running.
>
> **Prescriptive vs descriptive**: `/oh-my-joy:spec` (author) **prescribes** what to build against the FF criteria, while `/oh-my-joy:ff-review` **verifies (descriptive)** that the implemented diff honored them. Same FF SoT (the `frontend-fundamentals` skill), different stage. Visual regression is owned by `/oh-my-joy:verify`.

## Arguments

- (none) — review the working tree's uncommitted + staged changes (`git diff HEAD`).
- `--base <ref>` — review the whole branch diff against a base ref (`git diff <ref>...HEAD`). e.g. `--base main`, `--base origin/main`.

## Preflight (exit gracefully on failure)

1. **Git repository**: if `git rev-parse --is-inside-work-tree` fails → "not a git repository — skipping review" and stop.
2. **Change collection**: obtain the diff per the arguments.
   - Default: `git diff HEAD` (staged changes are covered by `git diff HEAD`) → if empty, also check `git diff --cached`.
   - `--base <ref>`: `git diff <ref>...HEAD`.
   - If the diff is empty → "no changes — nothing to review" and stop.
3. **Target filter**: keep only FE-related changed files (`.tsx`/`.jsx`/`.ts`/`.css`/`.scss` plus components/hooks/styles). If there are no FE changes → "no FE changes — not a review target" and stop.

## Review procedure

1. **Load the rubric**: invoke the **`frontend-fundamentals` skill** via `Skill` and use its `references/` (readability, predictability, cohesion, coupling, a11y) + routing rules as the standard. If the skill cannot be loaded → apply the 4 criteria by name only and note "FF skill not loaded — abridged rubric applied" (graceful, not an error).
2. **Per-change evaluation**: examine each changed file/hunk for the following — when cohesion/coupling cannot be judged from a hunk alone, `Read` the changed file's full source and check related symbols/usages with `Grep`/`Glob` so a diff fragment alone never causes a misjudgment.
   - **FF 4 criteria + a11y** — readability (context overload, nested ternaries), predictability (name≠behavior, hidden side effects), cohesion (scattered changes), coupling (props drilling 3+ levels), accessibility (alt, semantics, keyboard, touch targets), token deviations (raw hex / direct Primitive use).
   - **Figma fidelity** — per the FF skill's `references/figma-fidelity.md`: unauthorized changes to original text, invented variants absent from Figma, fixed px widths, and hardcoded tokens are violations (prescription happens in `/oh-my-joy:spec` Phase 2 — this is the verification stage of the same SoT).
   - **Performance, bundle, re-renders, data fetching** → refer to the `vercel-react-best-practices` skill criteria.
   - **Props bloat, extensible component APIs** → refer to the `vercel-composition-patterns` skill criteria.
   - **Next.js version-sensitive topics** (App Router, Server/Client boundary, `fetch` caching, `metadata`, `Image`, middleware, `next/dynamic`) → query the latest `/vercel/next.js` docs via Context7 and compare against recommendations.
   - The absence handling for the delegated layers (the two vercel skills, Context7) is canonized in the FF skill's "integrated routing rules" section — a missing layer is simply skipped (graceful, not an error; not restated here).
3. **Output**: group findings by severity — 🔴 blocker (behavioral/accessibility defects) · 🟡 major (principle violations, performance) · 🟢 minor·nit (style). Each item reads `file:line + violated principle + recommended fix`. **Never fix code** — report only.
4. **Summary**: counts per severity + "fix blockers/majors first; minors/nits can split into a follow-up PR".

## Usage

```
/oh-my-joy:ff-review                  review working-tree uncommitted+staged changes
/oh-my-joy:ff-review --base main      review the whole branch diff against main
/oh-my-joy:ff-review --base origin/main
```

> Run once right after implementation, before the PR, to block FF/a11y/vercel/nextjs violations. For visual regression, use `/oh-my-joy:verify <route>`.
