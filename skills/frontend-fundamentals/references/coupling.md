# Coupling

> Based on Toss frontend-fundamentals. Source: https://github.com/toss/frontend-fundamentals

**Principle**: lower inter-module dependencies so changing one place cannot break another. Low coupling is **extensibility**.

## 1. Reduce props drilling

Passing props through 3+ levels needlessly couples the intermediate components.

**Before**

```tsx
<Page post={post}>
  <Section post={post}>
    <Card post={post}>
      <Actions post={post} /> {/* 4-level drilling */}
```

**After** — cut the intermediate coupling with composition or context. **For detailed patterns refer to the `vercel-composition-patterns` skill** (compound components, context providers, render props, … — not re-explained in this skill).

```tsx
// core idea: intermediate components need not know about post
<PostProvider value={post}>
  <Page>
    <Section>
      <Card>
        <Actions /> {/* consumes directly via usePost() */}
```

## 2. Split over-responsible hooks

When one hook holds several concerns, changing one concern re-renders/re-runs unrelated call sites too.

**Before**

```ts
function usePostPage(id: string) {
  // data fetching + form state + image upload + share logic, all of it
}
```

**After** — split per concern to narrow dependencies.

```ts
function usePost(id: string) { ... }            // data
function usePostForm(data) { ... }               // form
function useImageUpload(id: string) { ... }      // upload
```

## 3. Deduplication vs premature abstraction

> Coupling's biggest trap: **the wrong abstraction is worse than duplication.**

Merging two pieces of code because "they happen to look alike now" means the abstraction shatters when one side's requirements change, coupling both. Abstract **only when they are certain to change together**.

## smell → remedy

| Smell                                | Remedy                                                     |
| ------------------------------------ | ---------------------------------------------------------- |
| Props drilling 3+ levels             | composition/context (see `vercel-composition-patterns`)    |
| One hook, many concerns              | Split hooks per concern                                    |
| Boolean prop proliferation           | Composition patterns (see `vercel-composition-patterns`)   |
| Premature abstraction of coincidence | Tolerate duplication until co-change is certain            |

## Overengineering warning

- Pulling everything into context to lower coupling hurts traceability. Leave ≤2-level props passing as is.
- Never create shared modules on the mere assumption "it might be reused".

> The performance view (re-render minimization, memoization) is delegated to the `vercel-react-best-practices` skill.
