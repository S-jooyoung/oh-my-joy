# Refactor

## When it applies

The structure of the code changes while its behavior stays the same: a split, a merge, a rename, a move, a simplification.

## Steps

1. Pin the behavior first, with the existing tests or a check written to pin what the code does now. Check: the pinning check passes on the code before any change.
2. Subtract before you add: remove dead code, duplicate paths, and options nothing sets. Check: the pinning check still passes.
3. Change the structure in small steps. Check: the pinning check passes after each step.
4. Move every caller to the new structure and delete the old one. Check: a search finds no remaining use of the old path.

## Principles to read

- [Subtract before you add](../principles/subtract-before-you-add.md)
- [Small verifiable steps](../principles/small-verifiable-steps.md)
- [Test behavior](../principles/test-behavior.md)
- [Migrate then delete](../principles/migrate-then-delete.md)
- [One owner per rule](../principles/one-owner-per-rule.md)
- [Redesign over patching](../principles/redesign-over-patching.md)

## Review

When the work edited a tracked file or added a new one, run one `critic` in a fresh context at the end. Skip the review when one file changed by two lines or fewer.

Hand the reviewer three files, which the next run overwrites:

- `.omj/review/last-request.md`: the user's request in its own words, the goal as you restated it, and the checks you used.
- `.omj/review/last.diff`: written with `git diff HEAD --output=.omj/review/last.diff`.
- `.omj/review/last.files`: the new files Git does not track yet, one path per line.

Fix every 🔴 and get a new review in a fresh context. After three failing reviews, stop and report both positions. Record each 🟡 in the report without another review.

## Report

Follow the five parts in [REPORTING.md](../REPORTING.md). Say how the structure changed, which check pinned the behavior, and what was deleted.
