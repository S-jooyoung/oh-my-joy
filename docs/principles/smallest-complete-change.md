# Smallest complete change

## When it applies

A request adds behavior: a feature, an option, an endpoint, or a helper.

## The rule

Take the first rung of the reuse ladder that holds: (1) not needed, because the request does not ask for it; (2) a symbol the repository already has; (3) the standard library or a platform feature; (4) an installed dependency; (5) the minimum new code. A new dependency is a decision to report, not a rung. Then finish every caller the change touches, so nothing is left half-wired.

## What it changes

- Write a new date-format module → call the formatter the repository already has, by path.
- Rename a field in the one handler you were asked about → move every reader of that field in the same change.

## Not this

Dropping a required part to keep the diff small. Smallest means the least that completes the request, not the least that compiles.
