# Bundling & Debug

> Based on Toss frontend-fundamentals. Source: https://github.com/toss/frontend-fundamentals

## Bundling

**Principle**: shrink the JavaScript users receive first. Services that must open fast on mobile are sensitive to initial bundle size.

### 1. dev and prod bundles differ

Dev mode includes HMR, sourcemaps, and validation code — slow and large. **Always judge performance against the production build** (`npm run build` or the repo script).

### 2. Code-split heavy components

```tsx
'use client';

import dynamic from 'next/dynamic';

// heavy modules unneeded on the initial screen: image lightboxes, maps, …
// ssr: false cannot be used in a Server Component — which is why this file is 'use client'.
const MapView = dynamic(() => import('@/components/map/map-view'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});
```

> Server Components are already auto code-split, so what `next/dynamic` actually lazy-loads is Client Components. Calling `dynamic()` inside a Server Component is possible per se, but `ssr: false` is not.

### 3. Beware barrel imports

Barrels like `import { X } from '@/components'` can defeat tree-shaking and grow the bundle. Import from concrete paths.

> **Detail delegation**: waterfall elimination, dynamic-import strategies, third-party deferring, preloading, and Suspense/streaming boundaries refer to the **`vercel-react-best-practices` skill** rule set. This document keeps only the entry-point summary (rule contents change upstream, so they are not written here — single SoT).

### Bundle smell → remedy

| Smell                                        | Remedy                          |
| -------------------------------------------- | ------------------------------- |
| Heavy module statically imported on first screen | Split with `next/dynamic`   |
| Bulk imports through barrel files            | Concrete-path imports           |
| Judging performance on dev builds            | Measure against production builds |

## Debug

**Principle**: narrow down by evidence, not guesses. Follow a systematic procedure.

### Debugging procedure

1. **Reproduce**: secure the smallest reproduction path (which input/state triggers it).
2. **Isolate**: bisect the change surface. Check whether a recent commit or branch switch caused it.
3. **Hypothesize–verify**: form "what being true would explain this bug" and verify with logs/observation. Keep competing hypotheses alive simultaneously.
4. **Root cause**: fix the cause, not the symptom.

### Common traps (suspect these first while debugging)

- **Ghost typecheck errors after a branch switch**: a stale build cache (`.next/types/` for Next.js) → delete the cache directory and rerun.
- **Empty results without errors**: when an authorization/filter layer returns insufficient permission as *0 rows instead of an error*, `catch` never fires. For "failed but silent" symptoms, suspect **auth session expiry** before exceptions.
- **Optimistic UI overwriting server state**: never delete/update persistent data based on volatile client state — apply only server-response-based diffs.

### Debug smell → remedy

| Smell                                | Remedy                                  |
| ------------------------------------ | --------------------------------------- |
| Editing several places at once on guesses | Verify one hypothesis at a time    |
| Unclear reproduction path            | Secure a minimal repro before starting  |
| Patches that only cover symptoms     | Fix the root cause                      |

## Overengineering warning

- Never pre-emptively code-split/memoize because "it feels slow" without measuring. **Profile/analyze the bundle first**, biggest first.
