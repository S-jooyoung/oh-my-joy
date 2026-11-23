# One owner per rule

## When it applies

A rule, a fact, or a constant would appear in more than one place: two documents, two modules, a doc and the code.

## The rule

Give it one owner. Write it in that one place and point to it from every other place, so a change lands once and copies cannot drift apart.

## What it changes

- Copy the retry limit into three files → define it once and import it.
- Restate a procedure in each command → keep it in one document that each command names.

## Not this

Merging unrelated rules because they look alike. Two rules that change for different reasons need two owners.
