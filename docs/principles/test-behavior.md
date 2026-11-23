# Test behavior

## When it applies

You are writing a new test or changing an existing one.

## The rule

Assert what a caller can observe: outputs, stored results, messages, rendered text. Leave internal calls, private helpers, and the order of steps out of the assertion, so the test survives a refactor and fails only when behavior breaks.

## What it changes

- Assert that a helper was called twice → assert the value the function returns.
- Snapshot the whole component tree → check the text and the state the user sees.

## Not this

Testing only the happy path because it is the observable one. Error cases are behavior too.
