---
name: frontend-fundamentals
description: Frontend code-quality guide based on Toss frontend-fundamentals. Applies the readability, predictability, cohesion, coupling, and accessibility principles when writing, modifying, or refactoring React components/hooks or reviewing code. Routes performance/bundle to vercel-react-best-practices, component composition/extensibility to vercel-composition-patterns, and latest Next.js APIs to Context7. Activates in FE contexts like "write a component" ("컴포넌트 작성"), "write a hook", "refactor this component/hook", "frontend code review", "readability" (backend/non-frontend code review is out of scope).
license: MIT
metadata:
  author: Jooyoung Shin
  version: '1.1.0'
  source: https://github.com/toss/frontend-fundamentals
---

# Frontend Fundamentals (integrated quality guide)

A guide organizing the "code that is easy to change" principles of Toss [frontend-fundamentals](https://github.com/toss/frontend-fundamentals) for the Next.js / React stack. The goal is **extensible, accessible, predictable code**.

## Core principle: the 4 criteria of good code

| Criterion                       | One-line definition                                   | Details                                                       |
| ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| **Readability**                 | Reduce the context code carries at once               | [references/readability.md](references/readability.md)        |
| **Predictability**              | Behavior is predictable from the name alone           | [references/predictability.md](references/predictability.md)  |
| **Cohesion**                    | Code that changes together lives together             | [references/cohesion.md](references/cohesion.md)              |
| **Coupling**                    | Lower inter-module dependencies to shrink change blast radius | [references/coupling.md](references/coupling.md)      |

> **Core trade-off**: satisfying all four at once is hard. Judge case by case which value to prioritize so the code becomes **easier to change long-term**. (e.g. abstracting for cohesion can raise coupling.)

Additional areas:

- **Accessibility (a11y)** → [references/a11y.md](references/a11y.md) — annotated with WCAG 2.2 success criteria (semantics, alt, contrast, focus, motion, touch targets, form errors)
- **Boundaries (Server/Client, errors, testability)** → [references/boundaries.md](references/boundaries.md) — where `'use client'` sits decides the bundle and the render model together
- **Bundle/debug** → [references/bundling-debug.md](references/bundling-debug.md)
- **Project acceptance axes (mechanism)** → [references/fe-acceptance.md](references/fe-acceptance.md) — reflects the "frequently missed axes" a project declares in `.omj/fe-context.md` into specs (the plugin forces no particular axis — general-purpose). Also the SoT for the token-system detection order.
- **Figma fidelity (universal design→code rules)** → [references/figma-fidelity.md](references/figma-fidelity.md) — keep original text, no invented variants, no fixed px (w-full + parent padding), no hardcoded tokens. `/omj` prescribes; `/oh-my-joy:ff-review`·`design-qa` verify.

## Quick checklist (smell → remedy)

| Smell                                                  | Principle              | Remedy                                     |
| ------------------------------------------------------ | ---------------------- | ------------------------------------------ |
| Nested ternaries / unnamed complex conditions          | Readability            | Named variables, early returns, split `if` |
| viewer/admin non-concurrent branches in one component  | Readability            | Split components per branch                |
| Magic numbers (`7`, `3600`) scattered                  | Readability·Cohesion   | Name them as meaningful constants          |
| Hidden side effects differing from the name            | Predictability         | Align name and behavior, split side effects |
| Same-kind functions with divergent return types        | Predictability         | Unify return shapes                        |
| Logic that changes together scattered across files     | Cohesion               | Gather into one unit (form/domain)         |
| Props drilling 3+ levels                               | Coupling               | composition/context (see routing below)    |
| Over-responsible hook (one hook, many concerns)        | Coupling               | Split hooks per concern                    |
| `<img>` missing alt / click-only `div`                 | Accessibility          | alt, semantic tags, keyboard handlers      |
| `'use client'` at the top of a page                    | Boundaries             | Push state into leaves, compose `children` |
| A single error boundary at the root                    | Boundaries             | `error.tsx` per independent failure zone   |

## Integrated routing rules (no duplication, composition first)

This skill owns **only the 4 quality criteria + accessibility**. The areas below are delegated to existing skills/tools:

- **Performance, bundle, re-renders, data fetching, serialization, Suspense boundaries** → refer to the `vercel-react-best-practices` skill. (waterfall elimination, `next/dynamic`, memoization, … **No rules are copied here** — upstream changes would instantly become drift.) In environments without the skill, skip this layer (graceful, not an error).
- **Props bloat, extensible component APIs, compound components** → refer to the `vercel-composition-patterns` skill. Skip if not installed (graceful, not an error).
- **Version gating** — the delegated skills contain React 19-only sections. Read `react`/`next` versions from the project's `package.json` to decide **only which sections apply and which to skip** (never duplicate rule content into this skill). If `package.json` is unreadable, skip gating (graceful).
- **Next.js version-sensitive topics — App Router, Server Components, `fetch` caching, metadata, …** → **query the latest official `/vercel/next.js` docs via the Context7 MCP** and apply the recommendations. (Runtime docs over training data.)
  - In environments without the Context7 MCP (`context7` plugin missing, CI), skip this layer and fall back to training-data general recommendations (not an error).
- **Deep a11y/UX audit** → use the `web-design-guidelines` skill's dynamic-fetch review. Skip if not installed (graceful, not an error).

## Overengineering warning

Never do the following "to obey" the principles:

- Do not needlessly abstract simple logic.
- Do not build deep hierarchies for future flexibility that will not happen.
- Improve the code itself instead of commenting on bad code.

## Companion command

`/oh-my-joy:ff-review` — integrated review of the current branch/staged diff against the 4 criteria above + a11y + Vercel performance/composition + Next.js (Context7) (read-only). Reuses the same FF SoT as `/omj` (prescription) at the verification stage.
