# Build the tool

## When it applies

The same manual step comes up a third time, or a manual check keeps being skipped.

## The rule

Turn the step into a script, a test, or a check that runs on its own, so the next run costs nothing and cannot be forgotten. Keep the tool as small as the step it replaces.

## What it changes

- Compare two files by eye before each release → add a check that fails when they differ.
- Rebuild the same fixture by hand for each test → write one helper that creates it.

## Not this

Building a framework for a step done once. Wait for the repeat before you automate.
