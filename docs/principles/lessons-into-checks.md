# Lessons into checks

## When it applies

A mistake happens, a review finds a defect, or the user corrects you, and the same thing could happen again.

## The rule

Turn the lesson into something that runs: a test, a guard, a lint rule, or a line in a checked document. A note that nobody reads does not stop the next occurrence; a check fails when it does.

## What it changes

- Remember to update both copies of a list → add a test that fails when the copies differ.
- Write "do not use the old name" in a note → add a check that rejects the old name.

## Not this

Adding a check for a one-time accident. Write the check when the mistake can recur.
