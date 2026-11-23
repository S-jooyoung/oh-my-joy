# Redesign over patching

## When it applies

The same spot needs its second or third fix, or each fix creates a new edge case beside it.

## The rule

Stop adding patches. Find the design decision that keeps producing the defect and change that decision, so the whole class of defects goes away rather than one more instance.

## What it changes

- Add a third null check on the same value → make the producer return a value that is never null.
- Add another retry for a race between two writers → give the data a single writer.

## Not this

Rewriting a module after one bug. A single defect is fixed at its origin; redesign is for a pattern that repeats.
