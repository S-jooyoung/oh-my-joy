# Predictability

> Based on Toss frontend-fundamentals. Source: https://github.com/toss/frontend-fundamentals

**Principle**: behavior must be predictable from a function's/variable's name and signature alone. The fewer hidden behaviors, the fewer mistakes at call sites.

## 1. Remove hidden side effects

When a name says "read" but the body mutates state, callers cannot predict it.

**Before** — `getPost` sneaks in logging + cache updates.

```ts
function getPost(id: string) {
  const data = api.fetchPost(id);
  analytics.track('post_viewed', { id }); // hidden side effect
  cache.set(id, data); // hidden side effect
  return data;
}
```

**After** — separate the read from the side effects.

```ts
function getPost(id: string) {
  return api.fetchPost(id);
}

// side effects are explicit at the call site
const post = getPost(id);
analytics.track('post_viewed', { id });
```

## 2. Align name and behavior

```ts
// Before: the name suggests a boolean but it returns a Promise
function checkLogin(): Promise<User> { ... }

// After: a name matching the behavior
function fetchLoggedInUser(): Promise<User> { ... }
```

## 3. Unify return types across same-kind functions

If sibling functions variously return `null`, throw, or return `undefined`, every call site must handle them differently.

**Before**

```ts
function fetchUser(id: string): User | null { ... }
function fetchPost(id: string): Post { /* throws when missing */ }
function fetchComment(id: string): Comment | undefined { ... }
```

**After** — one family, one convention.

```ts
// unified on the "null when missing" convention
function fetchUser(id: string): User | null { ... }
function fetchPost(id: string): Post | null { ... }
function fetchComment(id: string): Comment | null { ... }
```

## 4. Unify server-action return shapes

If server actions use a shape like `{ success: boolean, error?: string }`, follow it consistently within a project. One action returning a different shape breaks predictability.

## smell → remedy

| Smell                                     | Remedy                                          |
| ----------------------------------------- | ----------------------------------------------- |
| Hidden state mutation in a read function  | Move side effects to the call site              |
| Return type differing from the name       | Rename to match the behavior                    |
| Divergent return conventions in a family  | Unify per family (pick one of null/throw)       |
| Implicit global dependencies              | Inject explicitly as arguments                  |

## Overengineering warning

- Predictability does not require making every function pure. It suffices that side effects **show in the name** (e.g. `logPostView`).
