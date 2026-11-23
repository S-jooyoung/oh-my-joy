# See it fail first

## When it applies

You add a test, a guard, a lint rule, or any other check, or you fix a defect.

## The rule

Watch the check fail on the exact problem it targets before you trust its pass. Run it against the old code or plant the violation, confirm it fails at the right assertion, then make it pass. A check that never failed may not test anything.

## What it changes

- Write the fix and the test, then see green → run the test on the old code first and record the red run.
- Add a guard and move on → plant the forbidden value once and confirm the guard stops it.

## Not this

Counting any failure as the red run. An import error or an unrelated assertion proves nothing about the targeted problem.
