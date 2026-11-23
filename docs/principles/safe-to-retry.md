# Safe to retry

## When it applies

An operation can be interrupted, time out, or run twice: a write, a migration, a message send, a job.

## The rule

Make a second run harmless: the same input gives the same result, and an interrupted run can be resumed. Before retrying, read the current state to see what the first attempt already did.

## What it changes

- Append a row on every attempt → write by a stable key so a repeat replaces the row.
- Resend a message after a timeout → check whether the first send arrived before sending again.

## Not this

Retrying blindly in a loop. A retry without reading the current state can repeat the damage it meant to undo.
