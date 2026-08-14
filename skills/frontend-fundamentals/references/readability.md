# Readability

> Based on Toss frontend-fundamentals. Source: https://github.com/toss/frontend-fundamentals

**Principle**: reduce the context code carries at once. The less information a reader must hold in their head simultaneously, the easier the code reads.

## 1. Separate non-concurrent code

Never mix branches that only ever run in different situations into one component.

**Before** — one component carries the viewer/admin contexts at the same time.

```tsx
function PostActions({ post, role }: Props) {
  return (
    <div>
      {role === 'admin' ? (
        <button onClick={() => deletePost(post.id)}>Delete</button>
      ) : (
        <button onClick={() => sharePost(post.id)}>Share</button>
      )}
    </div>
  );
}
```

**After** — split components per branch so each holds a single context.

```tsx
function AdminPostActions({ post }: { post: Post }) {
  return <button onClick={() => deletePost(post.id)}>Delete</button>;
}

function ViewerPostActions({ post }: { post: Post }) {
  return <button onClick={() => sharePost(post.id)}>Share</button>;
}
```

## 2. Name complex conditions

An unnamed boolean expression forces every reader to re-derive "what does this mean".

**Before**

```tsx
if (user.age >= 18 && !user.isBanned && user.emailVerified) {
  showPurchaseButton();
}
```

**After**

```tsx
const canPurchase = user.age >= 18 && !user.isBanned && user.emailVerified;
if (canPurchase) {
  showPurchaseButton();
}
```

## 3. Eliminate nested ternaries

**Before**

```tsx
const label = isLoading
  ? 'Loading'
  : error
    ? 'Error'
    : data
      ? 'Done'
      : 'Idle';
```

**After** — flatten with early returns or `if`/a mapping object.

```tsx
function getLabel({ isLoading, error, data }: Status) {
  if (isLoading) return 'Loading';
  if (error) return 'Error';
  if (data) return 'Done';
  return 'Idle';
}
```

## 4. Name magic numbers

```tsx
// Before
setTimeout(refetch, 3600000);

// After
const ONE_HOUR_MS = 60 * 60 * 1000;
setTimeout(refetch, ONE_HOUR_MS);
```

## smell → remedy

| Smell                                        | Remedy                                        |
| -------------------------------------------- | --------------------------------------------- |
| Nested ternaries                             | `if`/early return/mapping object              |
| Unnamed complex boolean                      | Extract into a meaningful variable            |
| Non-concurrent branches in one component     | Split components per branch                   |
| Magic numbers                                | Named constants                               |
| Non-linear flow (jumping around)             | Bundle into condition objects/functions, one flow |

## Overengineering warning

- Extracting even one-or-two-line trivial logic into functions increases context instead.
- Extract conditions only "when the name adds meaning". Tautologies like `const isTrue = flag;` are forbidden.
