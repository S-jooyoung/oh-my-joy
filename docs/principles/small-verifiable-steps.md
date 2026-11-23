# Small verifiable steps

## When it applies

A change has several parts, touches several files, or carries risk.

## The rule

Split it into steps that each end in a check you can run. Take the next step only after the current one passes, so a failure points at the last small step instead of the whole change.

## What it changes

- Rewrite the module and run the tests at the end → move one function at a time and run its tests after each move.
- Change the schema and the code together → add the new column, check it, then switch the code to it.

## Not this

Splitting into steps nobody checks. A step without a check is just a smaller guess.
