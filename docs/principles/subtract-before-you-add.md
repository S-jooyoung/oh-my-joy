# Subtract before you add

## When it applies

A change would add a flag, a branch, a file, a setting, or a step to a process.

## The rule

First look for what the change makes unnecessary: dead branches, a duplicate path, an option nothing sets, a step that no longer guards anything. Remove that, then add only what is still missing. The result should be no larger than the problem needs.

## What it changes

- Add a second config flag beside an unused one → delete the unused flag and reuse its slot.
- Add a special case for one caller → remove the old workaround that made the special case necessary.

## Not this

Deleting code whose purpose you have not checked. Read why it exists, and keep it when a caller or a test still depends on it.
