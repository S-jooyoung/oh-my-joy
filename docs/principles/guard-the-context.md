# Guard the context

## When it applies

A task needs broad reading, a long log, or a large output that would fill the working context.

## The rule

Read only the part you need: the matching lines, the relevant section, the tail of a log. Hand bulk reading to a separate context that returns a conclusion, and keep the main context for decisions.

## What it changes

- Read every file in a directory to find one function → search for the name and read that function.
- Paste a full test log into the conversation → read the failing test's lines and the summary.

## Not this

Skipping a file you need to judge correctly. Save context on bulk, not on the evidence a decision rests on.
