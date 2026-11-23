# Make wrong states impossible

## When it applies

Two fields or flags must agree, or a value is only valid in some states: `loading` with `error`, `paid` without an amount.

## The rule

Shape the data so the wrong combination cannot be written: one status field instead of several booleans, a type per state, a constructor that refuses bad input. A state that cannot exist needs no check.

## What it changes

- Keep `isLoading`, `isError`, and `data` side by side → keep one `status` with the data that belongs to each status.
- Check that an end date follows the start date in every caller → refuse the bad range when the value is created.

## Not this

Encoding every business rule in types. Make the common wrong states impossible and check the rare ones where they enter.
