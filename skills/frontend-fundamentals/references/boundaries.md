# Boundaries — Server/Client · errors · testability

> In React 19 / Next.js App Router, **where you draw the boundary** decides bundle size, render model, and failure blast radius together.
> Knowledge upstream manages better — serialization rules, Suspense streaming strategy — is delegated to the `vercel-react-best-practices` skill; this document covers **where to draw the line** only.

## 1. Put `'use client'` at the leaves of the tree

`'use client'` pulls not just that one file but **everything below it** into the client bundle. Declared high up, it drags along subtrees that could have rendered statically.

```tsx
// Before — declared at the top of the page. Every component below enters the client bundle.
'use client';
export default function ProductPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ProductDescription />  {/* no interactivity, dragged along anyway */}
      <ReviewList />          {/* renders data only, dragged along anyway */}
      <BuyButton onClick={() => setOpen(true)} />
    </>
  );
}
```

```tsx
// After — only the state-using leaf goes client. The rest stays on the server.
export default function ProductPage() {
  return (
    <>
      <ProductDescription />
      <ReviewList />
      <BuyDialog />  {/* 'use client' only inside this file */}
    </>
  );
}
```

**Decision rule**: does the component use state, effects, browser APIs, or event handlers? If not, keep it on the server.

**Common trap** — passing a server component *as a child* of a client component is fine (the `children` prop), but *importing and rendering it* makes it client. The interactive-shell + `children`-slot combination is the standard pattern for keeping the boundary at the leaves.

## 2. Error boundaries — narrow the blast radius to component units

Without boundaries, one child component's exception wipes the whole screen.

- In App Router, each segment's `error.tsx` is that segment's boundary. A single root boundary drops every failure to a full-page fallback — put a boundary on **every area allowed to fail independently** (e.g. product info must survive the recommendation widget dying).
- Note `error.tsx` **does not catch errors thrown by the same segment's `layout.tsx`/`template.tsx`** — those are received by the parent segment's `error.tsx` (or `global-error.tsx` at the root layout). If you fetch data in a layout, the boundary must sit one level up.
- `error.tsx` is a client component and receives a retry prop. **A retry that refetches** is the default — Next 16.2+ has `unstable_retry()`; on earlier versions, or when only clearing the error state without refetching, use `reset()` (a version-sensitive topic — confirm the exact prop name via Context7 `/vercel/next.js`). **Never show only a message without a retry path.**
- Expected failures (empty results, no permission, 404) are handled as **normal render branches**, not error boundaries. Error boundaries are for *unexpected* exceptions.

## 3. Testability — the boundary is the test point

Among the FF 4 criteria, low **coupling** does not merely make testing easier — *a structure easy to test is itself a low-coupling structure*.

- **Pure logic out of components**: keeping condition math/formatting/sorting inside the render tree means spinning up a DOM to verify them each time. Extracted as pure functions, they test in place.
- **Injectable boundaries**: a component calling fetch, `Date.now()`, or `localStorage` directly at module top leaves no seam for a double. Flip it so values arrive via props or from a parent server component.
- Read **"can it be tested with accessible queries"** as a design signal — if `getByRole('button', { name: 'Save' })` cannot find it, neither can a screen reader (`references/a11y.md`).

## smell → remedy

| Smell                                                          | Remedy                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `'use client'` at the top of a page/layout                     | Push into state-using leaves, compose via `children` slots |
| A single error boundary at the root                            | `error.tsx` per independently failable area               |
| `error.tsx` without a retry path                               | Provide a refetching retry action (`unstable_retry()` ≥16.2, else `reset()`) |
| Catching layout fetch failures with the same segment's `error.tsx` | Move the boundary up a segment (root → `global-error.tsx`) |
| Throwing empty results / no-permission as exceptions           | Handle as normal render branches                          |
| Direct fetch/time/storage access inside a component            | Lift outside the boundary, make injectable                |
| Tests depending on implementation details (class names, indices) | Switch to role/label-based queries (the a11y axis)       |

## Overengineering warning

- The goal is not drawing "many" boundaries. Force-splitting client components creates prop drilling and only raises coupling.
- Put no error boundary where failures have no reason to be handled independently — you gain fallback UI and user confusion.
