# Cohesion

> Based on Toss frontend-fundamentals. Source: https://github.com/toss/frontend-fundamentals

**Principle**: code that is modified together lives together. Needing to touch several files for one change is a low-cohesion signal.

## 1. Gather code that changes together

**Before** — validation rules scattered across schema, component, and constants files: changing one rule means editing 3 places.

```
src/schema/basic-form-schema.ts   // title min(1)
src/components/forms/basic/...tsx  // hardcoded error message
src/constants/form-limits.ts       // length limits
```

**After** — gather one domain's rules into one unit (the schema).

```ts
// schema/basic-form-schema.ts — messages and limits in one place
export const basicFormSchema = z.object({
  title: z.string().min(1, 'Please enter a title').max(20),
});
```

## 2. Forms: choosing field-level vs whole-form cohesion

How to raise cohesion depends on the situation. **There is no single right answer.**

| Approach         | Cohesion unit                            | Strength                          | Fits when                                                        |
| ---------------- | ---------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| **Field-level**  | Each field owns its validation/state     | Reusability·independence ↑        | Fields are reused independently or added/removed dynamically     |
| **Whole-form**   | The form owns all state/validation       | Consistent flow, easy cross-validation | Many inter-field dependencies (password confirm, …) and one submit flow |

`react-hook-form + zod` forms are usually natural as **whole-form** (one schema validates everything).

## 3. Bundle magic values into meaning units

Gathering scattered magic values into domain constants means one change touches one place.

```ts
// constants/upload.ts
export const PENDING_UPLOAD_TTL_DAYS = 7; // eager-upload TTL — managed in one place
```

## smell → remedy

| Smell                                       | Remedy                                          |
| ------------------------------------------- | ----------------------------------------------- |
| One rule change touches several files       | Move what changes together into one unit        |
| Validation/messages/limits dispersed        | Cohere into a domain schema                     |
| The same magic value defined in duplicates  | A single constants file (like `storage-keys.ts`) |

## Overengineering warning

- Force-merging into one file for cohesion raises coupling and bloats the file. Gather **only what changes together**.
- Fields where reuse/independence matters more need not be folded into the whole form.

> Note: duplicating the same localStorage key in several places invites divergence → keeping keys only in `src/constants/storage-keys.ts` is the cohesion principle applied in practice.
