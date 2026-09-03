---
name: frontend-fundamentals
description: Frontend code-quality guide based on Toss frontend-fundamentals. Applies the readability, predictability, cohesion, coupling, and accessibility principles when writing, modifying, or refactoring React components/hooks or reviewing code. Routes performance/bundle to vercel-react-best-practices, component composition/extensibility to vercel-composition-patterns, and latest Next.js APIs to Context7. Activates in FE contexts like "write a component" ("컴포넌트 작성"), "write a hook", "refactor this component/hook", "frontend code review", "readability" (backend/non-frontend code review is out of scope).
license: MIT
metadata:
  author: Jooyoung Shin
  version: '1.3.0'
  source: https://github.com/toss/frontend-fundamentals
---

# Frontend Fundamentals (integrated quality guide)

A guide organizing the "code that is easy to change" principles of Toss [frontend-fundamentals](https://github.com/toss/frontend-fundamentals) for the Next.js / React stack. The goal is extensible, accessible, predictable code.

## The four criteria of good code

| Criterion | One-line definition | Details |
| --- | --- | --- |
| Readability | Reduce the context code carries at once | [references/readability.md](references/readability.md) |
| Predictability | Behavior is predictable from the name alone | [references/predictability.md](references/predictability.md) |
| Cohesion | Code that changes together lives together | [references/cohesion.md](references/cohesion.md) |
| Coupling | Lower inter-module dependencies to shrink the change blast radius | [references/coupling.md](references/coupling.md) |

Satisfying all four at once is hard; judge case by case which value to prioritize so the code becomes easier to change long-term (abstracting for cohesion can raise coupling, for example).

Additional areas:

- Accessibility → [references/a11y.md](references/a11y.md) — annotated with WCAG 2.2 success criteria (semantics, alt, contrast, focus, motion, touch targets, form errors)
- Boundaries (Server/Client, errors, testability) → [references/boundaries.md](references/boundaries.md) — where `'use client'` sits decides the bundle and the render model together
- Bundle and debugging → [references/bundling-debug.md](references/bundling-debug.md)
- Project acceptance axes and verification commands (mechanism) → [references/fe-acceptance.md](references/fe-acceptance.md) — reflects the axes a project declares in `.omj/fe-context.md` into specs; the plugin forces no particular axis. Also the source of truth for the token-system detection order.
- Figma fidelity (universal design→code rules) → [references/figma-fidelity.md](references/figma-fidelity.md) — keep original text, no invented variants, no fixed px (`w-full` plus parent padding), no hardcoded tokens. `/oh-my-joy:spec` prescribes; `/oh-my-joy:review` and `design-qa` verify.

## Quick checklist (smell → remedy)

| Smell | Principle | Remedy |
| --- | --- | --- |
| Nested ternaries, unnamed complex conditions | Readability | Named variables, early returns, split `if` |
| viewer/admin non-concurrent branches in one component | Readability | Split components per branch |
| Magic numbers (`7`, `3600`) scattered | Readability, Cohesion | Name them as meaningful constants |
| Hidden side effects differing from the name | Predictability | Align name and behavior, split side effects |
| Same-kind functions with divergent return types | Predictability | Unify return shapes |
| Logic that changes together scattered across files | Cohesion | Gather into one unit (form, domain) |
| Props drilling 3+ levels | Coupling | Composition or context (see routing below) |
| Over-responsible hook (one hook, many concerns) | Coupling | Split hooks per concern |
| `<img>` missing alt, click-only `div` | Accessibility | alt, semantic tags, keyboard handlers |
| `'use client'` at the top of a page | Boundaries | Push state into leaves, compose `children` |
| A single error boundary at the root | Boundaries | `error.tsx` per independent failure zone |

## Routing rules (no duplication, composition first)

This skill owns only the four quality criteria plus accessibility. The areas below are delegated, and a missing layer is skipped rather than treated as an error:

- Performance, bundle, re-renders, data fetching, serialization, Suspense boundaries → the `vercel-react-best-practices` skill. No rules are copied here, because a copy would drift the moment upstream changes.
- Props bloat, extensible component APIs, compound components → the `vercel-composition-patterns` skill.
- Version gating — the delegated skills contain React 19-only sections. Read the `react` and `next` versions from `package.json` to decide which sections apply; if `package.json` is unreadable, skip gating.
- Next.js version-sensitive topics (App Router, Server Components, `fetch` caching, metadata, …) → query the current `/vercel/next.js` docs via the Context7 MCP and apply the recommendations; without Context7, fall back to general recommendations.
- Deep a11y/UX audit → the `web-design-guidelines` skill's dynamic-fetch review.

## Overengineering warning

The principles are not a license to add layers: do not abstract simple logic, do not build deep hierarchies for flexibility that will not be needed, and improve the code itself instead of commenting on bad code.

## Companion commands

`/oh-my-joy:spec` prescribes with this rubric at authoring time; `/oh-my-joy:review` verifies the diff against it afterwards (frontend files get the four criteria + a11y + Figma fidelity + vercel + Next.js; other files get correctness, simplicity, consistency, and test coverage). Same source of truth, two stages.
